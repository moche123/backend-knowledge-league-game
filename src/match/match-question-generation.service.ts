import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// Moonshot call is mocked out below (2026-08-31, explicit user request —
// Moonshot's API was observed hanging for minutes on chat completions even
// though /v1/models responds instantly; see BASE_CONOCIMIENTO.md). Real
// implementation kept commented out in callAi() for a quick revert —
// uncomment `BadGatewayException` above and `OpenAI` below along with it.
// import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { delay, firstValueFrom, of } from 'rxjs';
import { z } from 'zod';
import { MatchQuestion } from './entities/match-question.entity';
import { Tournament } from '../tournament/entities/tournament.entity';

const GeneratedQuestionSchema = z.object({
  text: z.string(),
  rubric: z.string(),
  suggestedMaxScore: z.number().positive(),
});
// Only used by the commented-out real callAi() below (parses the full
// `{questions: [...]}` response envelope) — unused while mocked.
// const GeneratedQuestionsSchema = z.object({
//   questions: z.array(GeneratedQuestionSchema),
// });

const DEFAULT_TIME_LIMIT_SECONDS = 30;

// // Moonshot AI (Kimi) — API compatible with the OpenAI format. Chosen for the
// // MVP at the user's request (they have their own API key); CLAUDE.md documents
// // this decision in the AI evaluator/generator agent section.
// const MOONSHOT_BASE_URL = 'https://api.moonshot.ai/v1';
// const MOONSHOT_MODEL = 'kimi-k2.6';
//
// const QUESTIONS_JSON_SCHEMA = {
//   type: 'object',
//   properties: {
//     questions: {
//       type: 'array',
//       items: {
//         type: 'object',
//         properties: {
//           text: { type: 'string' },
//           rubric: { type: 'string' },
//           suggestedMaxScore: { type: 'number' },
//         },
//         required: ['text', 'rubric', 'suggestedMaxScore'],
//         additionalProperties: false,
//       },
//     },
//   },
//   required: ['questions'],
//   additionalProperties: false,
// } as const;

// Fixed fixture used by the mock callAi() below — always the same 10
// questions, parsed from `## N` blocks with `Text:`/`Rubric:`/`Score:` lines.
const MOCK_QUESTIONS_PATH = join(process.cwd(), 'mock-questions.md');
const MOCK_QUESTION_BLOCK =
  /## \d+\s*\nText:\s*(.+)\s*\nRubric:\s*(.+)\s*\nScore:\s*(\d+(?:\.\d+)?)/g;
const MOCK_GENERATION_DELAY_MS = 5000;

function loadMockQuestions(): z.infer<typeof GeneratedQuestionSchema>[] {
  const markdown = readFileSync(MOCK_QUESTIONS_PATH, 'utf-8');
  const questions: z.infer<typeof GeneratedQuestionSchema>[] = [];
  for (const match of markdown.matchAll(MOCK_QUESTION_BLOCK)) {
    questions.push(
      GeneratedQuestionSchema.parse({
        text: match[1].trim(),
        rubric: match[2].trim(),
        suggestedMaxScore: Number(match[3]),
      }),
    );
  }
  return questions;
}

@Injectable()
export class MatchQuestionGenerationService {
  constructor(
    @InjectRepository(MatchQuestion)
    private readonly matchQuestionRepository: Repository<MatchQuestion>,
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
    private readonly configService: ConfigService,
  ) {}

  // Triggered from MatchService.schedule() — never from its own endpoint.
  // No shared bank: each match generates its own `questionsPerMatch`
  // questions, avoiding repeating text against EVERYTHING already generated
  // in the event (other matches included) — so a player who already played
  // can't leak a question to someone who hasn't played it yet.
  // If the match already had questions (reschedule), they're discarded and
  // a fresh set is generated — always regenerates, never reuses.
  async generateForMatch(
    eventId: string,
    matchId: string,
  ): Promise<MatchQuestion[]> {
    const event = await this.tournamentRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event #${eventId} not found`);
    }

    const existingTexts = await this.matchQuestionRepository
      .createQueryBuilder('mq')
      .innerJoin('matches', 'm', 'm.id = mq.match_id')
      .innerJoin('stages', 's', 's.id = m.stage_id')
      .where('s.event_id = :eventId', { eventId })
      .select('mq.text', 'text')
      .getRawMany<{ text: string }>();

    const generated = await this.callAi(
      event.theme,
      event.questionsPerMatch,
      existingTexts.map((row) => row.text),
    );
    const scaledScores = this.normalizeScores(
      generated.map((question) => question.suggestedMaxScore),
      Number(event.maxScorePerMatch),
    );

    await this.matchQuestionRepository.delete({ matchId });

    const questions = generated.map((question, index) =>
      this.matchQuestionRepository.create({
        matchId,
        position: index + 1,
        text: question.text,
        rubric: question.rubric,
        maxScore: scaledScores[index],
        timeLimit: DEFAULT_TIME_LIMIT_SECONDS,
      }),
    );
    return this.matchQuestionRepository.save(questions);
  }

  // MOCKED (2026-08-31, explicit user request) — reads the fixed 10-question
  // fixture in mock-questions.md instead of calling Moonshot, cycling through
  // it if `count` > 10. Simulates generation latency with an RxJS delay (5s —
  // reading the file is near-instant, so without this the UI never shows a
  // realistic loading state). `existingTexts`/`theme` are intentionally
  // unused here — the mock doesn't do topic-matching or anti-repeat, every
  // match gets the exact same 10 (in order, cycled). Real implementation
  // below, commented out — uncomment and delete this block to restore it.
  private async callAi(
    _theme: string,
    count: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _existingTexts: string[],
  ): Promise<z.infer<typeof GeneratedQuestionSchema>[]> {
    const pool = loadMockQuestions();
    const selected = Array.from(
      { length: count },
      (_, index) => pool[index % pool.length],
    );
    return await firstValueFrom(
      of(selected).pipe(delay(MOCK_GENERATION_DELAY_MS)),
    );
  }

  // private async callAi(
  //   theme: string,
  //   count: number,
  //   existingTexts: string[],
  // ): Promise<z.infer<typeof GeneratedQuestionSchema>[]> {
  //   const apiKey = this.configService.getOrThrow<string>('MOONSHOT_API_KEY');
  //   const client = new OpenAI({ apiKey, baseURL: MOONSHOT_BASE_URL });
  //
  //   const avoidList = existingTexts.length
  //     ? `Questions that ALREADY exist for this event, in other matches (don't repeat them or generate obvious variants — a player who already answered them could leak them to another):\n${existingTexts
  //         .map((text) => `- ${text}`)
  //         .join('\n')}\n\n`
  //     : '';
  //
  //   let content: string | null;
  //   try {
  //     const response = await client.chat.completions.create({
  //       model: MOONSHOT_MODEL,
  //       messages: [
  //         {
  //           role: 'system',
  //           content:
  //             'You are a trivia question generator for a competitive knockout knowledge ' +
  //             'tournament. Difficulty level: HARD — this is a competition, questions must ' +
  //             'demand real, specific knowledge, not surface-level trivia. Each question is ' +
  //             'answered in free text (not multiple choice) and later graded by an AI against ' +
  //             'the rubric you generate, so the rubric must clearly describe what a correct ' +
  //             'answer must contain (expected key points, not just "the answer is X"). ' +
  //             'Write everything in English.',
  //         },
  //         {
  //           role: 'user',
  //           content:
  //             `${avoidList}Generate exactly ${count} new, hard questions about the topic ` +
  //             `"${theme}", with varying difficulty among them (all hard, but not identically ` +
  //             'demanding), with a suggested score (positive number) proportional ' +
  //             'to that relative difficulty.',
  //         },
  //       ],
  //       response_format: {
  //         type: 'json_schema',
  //         json_schema: {
  //           name: 'generated_questions',
  //           schema: QUESTIONS_JSON_SCHEMA,
  //         },
  //       },
  //     });
  //     content = response.choices[0]?.message?.content ?? null;
  //   } catch {
  //     throw new BadGatewayException(
  //       'AI question generation failed — try again',
  //     );
  //   }
  //
  //   if (!content) {
  //     throw new BadGatewayException(
  //       'AI question generation failed — try again',
  //     );
  //   }
  //
  //   let parsed: z.infer<typeof GeneratedQuestionsSchema>;
  //   try {
  //     parsed = GeneratedQuestionsSchema.parse(JSON.parse(content));
  //   } catch {
  //     throw new BadGatewayException(
  //       'AI returned an unexpected format — try again',
  //     );
  //   }
  //
  //   if (parsed.questions.length !== count) {
  //     throw new BadGatewayException(
  //       'AI question generation failed — try again',
  //     );
  //   }
  //   return parsed.questions;
  // }

  // Rescales the AI-suggested scores so they sum to EXACTLY the event's
  // maxScorePerMatch — it's the denominator for the scoring formula's 0-100
  // normalization (see CLAUDE.md).
  private normalizeScores(raw: number[], targetTotal: number): number[] {
    const rawTotal = raw.reduce((sum, value) => sum + value, 0);
    const scale = targetTotal / rawTotal;
    const scaled = raw.map((value) => round2(value * scale));

    const scaledTotal = scaled.reduce((sum, value) => sum + value, 0);
    const remainder = round2(targetTotal - scaledTotal);
    scaled[scaled.length - 1] = round2(scaled[scaled.length - 1] + remainder);
    return scaled;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
