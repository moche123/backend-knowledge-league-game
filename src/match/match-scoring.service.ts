import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { z } from 'zod';
import {
  computeQuality,
  computeResult,
  computeVelocity,
} from './match-scoring-formula';
import { Answer } from './entities/answer.entity';
import { MatchQuestion } from './entities/match-question.entity';
import { Match, MatchStatus } from './entities/match.entity';

const WALKOVER_PENALTY = 50;

const EvaluationSchema = z.object({
  evaluations: z.array(
    z.object({
      answerIndex: z.number().int(),
      score: z.number(),
      justification: z.string(),
    }),
  ),
});

const EVALUATION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    evaluations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          answerIndex: { type: 'integer' },
          score: { type: 'number' },
          justification: { type: 'string' },
        },
        required: ['answerIndex', 'score', 'justification'],
        additionalProperties: false,
      },
    },
  },
  required: ['evaluations'],
  additionalProperties: false,
} as const;

// Same provider as question generation (Moonshot/Kimi, user's decision for the MVP).
const MOONSHOT_BASE_URL = 'https://api.moonshot.ai/v1';
const MOONSHOT_MODEL = 'kimi-k2.6';

@Injectable()
export class MatchScoringService {
  private readonly logger = new Logger(MatchScoringService.name);

  constructor(
    @InjectRepository(Answer)
    private readonly answerRepository: Repository<Answer>,
    @InjectRepository(MatchQuestion)
    private readonly matchQuestionRepository: Repository<MatchQuestion>,
    private readonly configService: ConfigService,
  ) {}

  // Evaluates the answers of ONE closed question (one or both players) —
  // on the fly, as soon as that question is left behind (both answered,
  // or the deadline passed). If nobody answered, there's nothing to evaluate.
  // Both answers are evaluated in the SAME call (same criteria, see CLAUDE.md).
  async evaluateQuestion(matchQuestion: MatchQuestion): Promise<void> {
    const answers = await this.answerRepository.find({
      where: { matchId: matchQuestion.matchId, questionId: matchQuestion.id },
    });
    if (answers.length === 0) return;

    let evaluations: z.infer<typeof EvaluationSchema>['evaluations'];
    try {
      evaluations = await this.callAi(matchQuestion, answers);
    } catch (error) {
      // Don't block match progress on an AI failure — leave it unscored
      // (null), admin can review/retry by hand later.
      this.logger.error(
        `AI evaluation failed for question ${matchQuestion.id}: ${(error as Error).message}`,
      );
      return;
    }

    for (const evaluation of evaluations) {
      const answer = answers[evaluation.answerIndex];
      if (!answer) continue;
      answer.aiScore = clamp(
        evaluation.score,
        0,
        Number(matchQuestion.maxScore),
      );
      answer.aiJustification = evaluation.justification;
    }
    await this.answerRepository.save(answers);
  }

  // Called when the match closes (CLOSED or WALKOVER already decided) —
  // computes each player's final result and decides the winner. Doesn't change status.
  async computeMatchResult(match: Match): Promise<void> {
    if (!match.playerAId && !match.playerBId) return;

    const matchQuestions = await this.matchQuestionRepository.find({
      where: { matchId: match.id },
    });
    const answers = await this.answerRepository.find({
      where: { matchId: match.id },
    });
    const denominator = matchQuestions.reduce(
      (sum, question) => sum + Number(question.maxScore),
      0,
    );

    if (match.status === MatchStatus.WALKOVER) {
      this.applyWalkoverResult(match, matchQuestions, answers, denominator);
      return;
    }

    const qualityA = computeQuality(
      this.sumScores(answers, match.playerAId),
      denominator,
    );
    const qualityB = computeQuality(
      this.sumScores(answers, match.playerBId),
      denominator,
    );

    const maxPossibleDiffSeconds = matchQuestions.reduce(
      (sum, question) => sum + question.timeLimit,
      0,
    );
    const elapsedA = this.totalElapsedSeconds(
      matchQuestions,
      answers,
      match.playerAId,
    );
    const elapsedB = this.totalElapsedSeconds(
      matchQuestions,
      answers,
      match.playerBId,
    );
    const { velocityA, velocityB } = computeVelocity(
      elapsedA,
      elapsedB,
      maxPossibleDiffSeconds,
    );

    match.scoreA = computeResult(qualityA, velocityA);
    match.scoreB = computeResult(qualityB, velocityB);
    match.winnerId =
      match.scoreA === match.scoreB
        ? null
        : match.scoreA > match.scoreB
          ? match.playerAId
          : match.playerBId;
  }

  private applyWalkoverResult(
    match: Match,
    matchQuestions: MatchQuestion[],
    answers: Answer[],
    denominator: number,
  ): void {
    const answeredByA = answers.some(
      (answer) => answer.playerId === match.playerAId,
    );
    const presentPlayerId = answeredByA ? match.playerAId : match.playerBId;
    const absentPlayerId = answeredByA ? match.playerBId : match.playerAId;

    const presentQuality = computeQuality(
      this.sumScores(answers, presentPlayerId),
      denominator,
    );
    // No opponent present, so there's no "velocity vs opponent" — the present
    // player's result is just their quality (see CLAUDE.md). The absent
    // player gets the flat -50 penalty on their result.
    const presentResult = round2(presentQuality);
    const absentResult = round2(0 - WALKOVER_PENALTY);

    if (presentPlayerId === match.playerAId) {
      match.scoreA = presentResult;
      match.scoreB = absentPlayerId ? absentResult : null;
    } else {
      match.scoreB = presentResult;
      match.scoreA = absentPlayerId ? absentResult : null;
    }
    match.winnerId = presentPlayerId;
  }

  // Admin's override (Fase 10) overrides the AI score when it exists —
  // it's the final correction after a dispute.
  private sumScores(answers: Answer[], playerId: string | null): number {
    if (!playerId) return 0;
    return answers
      .filter((answer) => answer.playerId === playerId)
      .reduce((sum, answer) => {
        const effective = answer.adminOverrideScore ?? answer.aiScore;
        return effective === null ? sum : sum + Number(effective);
      }, 0);
  }

  private totalElapsedSeconds(
    matchQuestions: MatchQuestion[],
    answers: Answer[],
    playerId: string | null,
  ): number {
    if (!playerId) return 0;
    return matchQuestions.reduce((sum, question) => {
      const answer = answers.find(
        (a) => a.questionId === question.id && a.playerId === playerId,
      );
      if (!answer || !question.activatedAt) {
        return sum + question.timeLimit; // didn't answer — "used" the whole time
      }
      const elapsed =
        (answer.submittedAt.getTime() - question.activatedAt.getTime()) / 1000;
      return sum + Math.max(0, elapsed);
    }, 0);
  }

  private async callAi(
    matchQuestion: MatchQuestion,
    answers: Answer[],
  ): Promise<z.infer<typeof EvaluationSchema>['evaluations']> {
    const apiKey = this.configService.getOrThrow<string>('MOONSHOT_API_KEY');
    const client = new OpenAI({ apiKey, baseURL: MOONSHOT_BASE_URL });

    const answersBlock = answers
      .map(
        (answer, index) =>
          `Answer ${index} (player ${index}): """${answer.answerText}"""`,
      )
      .join('\n\n');

    const response = await client.chat.completions.create({
      model: MOONSHOT_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are the evaluator for a knockout knowledge tournament. You grade ' +
            'free-text answers against a rubric, with strict, consistent criteria across ' +
            'players — both answers to the same question are evaluated together, in this ' +
            "same call, so the criteria doesn't vary between them. The score ranges from 0 " +
            "to the question's maximum score. Always justify in English, citing which rubric " +
            "points each answer did or didn't meet.",
        },
        {
          role: 'user',
          content:
            `Question: ${matchQuestion.text}\n` +
            `Rubric / expected answer: ${matchQuestion.rubric}\n` +
            `Max score: ${matchQuestion.maxScore}\n\n${answersBlock}\n\n` +
            `Evaluate each answer (answerIndex 0${answers.length > 1 ? ' and 1' : ''}) with its score and justification.`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'evaluations', schema: EVALUATION_JSON_SCHEMA },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('AI evaluation returned empty content');
    }
    return EvaluationSchema.parse(JSON.parse(content)).evaluations;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
