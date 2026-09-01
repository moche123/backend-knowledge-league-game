import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { CreateMatchQuestionDto } from './dto/create-match-question.dto';
import { DisqualifyPlayerDto } from './dto/disqualify-player.dto';
import { EditParticipantsDto } from './dto/edit-participants.dto';
import { OverrideAnswerScoreDto } from './dto/override-answer-score.dto';
import { ReopenMatchDto } from './dto/reopen-match.dto';
import { ScheduleMatchDto } from './dto/schedule-match.dto';
import { SetMatchRefereeDto } from './dto/set-match-referee.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { UpdateMatchQuestionDto } from './dto/update-match-question.dto';
import { Answer } from './entities/answer.entity';
import { MatchQuestion } from './entities/match-question.entity';
import { Match, MatchStatus } from './entities/match.entity';
import { MatchQuestionGenerationService } from './match-question-generation.service';
import { MatchScoringService } from './match-scoring.service';
import { Stage } from '../stage/entities/stage.entity';
import { StageService } from '../stage/stage.service';
import { RankingService } from '../ranking/ranking.service';
import { Registration } from '../registration/entities/registration.entity';
import { Tournament } from '../tournament/entities/tournament.entity';
import { DisputeChatMessage } from '../dispute-chat/entities/dispute-chat-message.entity';
import { User, UserRole } from '../auth/entities/user.entity';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

const PG_UNIQUE_VIOLATION = '23505';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface CurrentQuestionView {
  position: number;
  totalQuestions: number;
  questionText: string;
  timeLimit: number;
  deadline: Date | null;
  youAnswered: boolean;
  opponentAnswered: boolean;
}

@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);

  constructor(
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    @InjectRepository(Stage)
    private readonly stageRepository: Repository<Stage>,
    @InjectRepository(Registration)
    private readonly registrationRepository: Repository<Registration>,
    @InjectRepository(MatchQuestion)
    private readonly matchQuestionRepository: Repository<MatchQuestion>,
    @InjectRepository(Answer)
    private readonly answerRepository: Repository<Answer>,
    @InjectRepository(DisputeChatMessage)
    private readonly chatMessageRepository: Repository<DisputeChatMessage>,
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly matchQuestionGenerationService: MatchQuestionGenerationService,
    private readonly matchScoringService: MatchScoringService,
    private readonly stageService: StageService,
    private readonly rankingService: RankingService,
  ) {}

  async findOne(eventId: string, matchId: string): Promise<Match> {
    return this.getMatchOrThrow(eventId, matchId);
  }

  // Admin sets or updates the schedule (start time + duration) — allowed while
  // the match hasn't started yet, or to reschedule one that expired unplayed.
  // Same call generates (or, if it already had one, regenerates from scratch)
  // this match's question set via AI — no shared bank, each match owns its
  // own, and there's no separate "generate" step. (2026-08-31, explicit user
  // decision — a same-day earlier version split scheduling and generation
  // into two actions gated on participants/referee; reverted, generation is
  // simply "click Schedule match".) If the AI call fails, the reschedule isn't
  // saved either (validated and generated BEFORE touching the time).
  //
  // Requires both participants AND the referee already set (2026-08-31,
  // explicit user decision), and the computed end time can't fall after the
  // event's own end date.
  async schedule(
    eventId: string,
    matchId: string,
    dto: ScheduleMatchDto,
  ): Promise<Match> {
    const match = await this.getMatchOrThrow(eventId, matchId);
    if (
      match.status !== MatchStatus.PENDING &&
      match.status !== MatchStatus.EXPIRED
    ) {
      throw new ConflictException(
        `Cannot (re)schedule a match with status "${match.status}"`,
      );
    }
    if (!match.playerAId || !match.playerBId) {
      throw new BadRequestException(
        'Both participants must be set before scheduling this match',
      );
    }
    if (!match.refereeId) {
      throw new BadRequestException(
        'A referee must be assigned before scheduling this match',
      );
    }

    const scheduledStartAt = new Date(dto.scheduledStartAt);
    const scheduledEndAt = new Date(
      scheduledStartAt.getTime() + dto.durationMinutes * 60_000,
    );

    const event = await this.tournamentRepository.findOneOrFail({
      where: { id: eventId },
    });
    if (scheduledEndAt > event.endDate) {
      throw new BadRequestException(
        "Cannot schedule a match to end after the event's end date",
      );
    }

    await this.matchQuestionGenerationService.generateForMatch(
      eventId,
      match.id,
    );

    match.scheduledStartAt = scheduledStartAt;
    match.scheduledEndAt = scheduledEndAt;
    match.status = MatchStatus.PENDING;
    return this.matchRepository.save(match);
  }

  // Admin assigns/changes the match referee — manual only, no auto-pick, no
  // time-slot/calendar check. Same pre-match gate as editParticipants().
  async setReferee(
    eventId: string,
    matchId: string,
    dto: SetMatchRefereeDto,
  ): Promise<Match> {
    const match = await this.getMatchOrThrow(eventId, matchId);
    if (match.status !== MatchStatus.PENDING) {
      throw new ConflictException(
        `Cannot assign a referee to a match with status "${match.status}"`,
      );
    }

    const referee = await this.userRepository.findOne({
      where: { id: dto.refereeId },
    });
    if (!referee || referee.role !== UserRole.REFEREE) {
      throw new BadRequestException(
        `#${dto.refereeId} is not a referee account`,
      );
    }

    match.refereeId = dto.refereeId;
    return this.matchRepository.save(match);
  }

  // Admin changes one or both participants — only before the match starts
  // (e.g. something came up in chat and the pairing needs correcting). Post-match
  // correction (disqualification/substitution/repeating a closed match) is
  // for once the full scoring flow exists (see CLAUDE.md Fase 10).
  async editParticipants(
    eventId: string,
    matchId: string,
    dto: EditParticipantsDto,
  ): Promise<Match> {
    if (!dto.playerAId && !dto.playerBId) {
      throw new BadRequestException('Provide playerAId and/or playerBId');
    }

    const match = await this.getMatchOrThrow(eventId, matchId);
    if (match.status !== MatchStatus.PENDING) {
      throw new ConflictException(
        `Cannot edit participants of a match with status "${match.status}"`,
      );
    }

    const nextPlayerAId = dto.playerAId ?? match.playerAId;
    const nextPlayerBId = dto.playerBId ?? match.playerBId;
    if (nextPlayerAId && nextPlayerAId === nextPlayerBId) {
      throw new BadRequestException(
        'playerAId and playerBId must be different',
      );
    }

    const candidateIds = [dto.playerAId, dto.playerBId].filter(
      (id): id is string => !!id,
    );
    for (const userId of candidateIds) {
      const isRegistered = await this.registrationRepository.exists({
        where: { eventId, userId },
      });
      if (!isRegistered) {
        throw new BadRequestException(
          `User #${userId} is not registered for this event`,
        );
      }

      const alreadyInAnotherMatch = await this.matchRepository
        .createQueryBuilder('match')
        .where('match.stage_id = :stageId', { stageId: match.stageId })
        .andWhere('match.id != :matchId', { matchId })
        .andWhere(
          '(match.player_a_id = :userId OR match.player_b_id = :userId)',
          {
            userId,
          },
        )
        .getExists();
      if (alreadyInAnotherMatch) {
        throw new ConflictException(
          `User #${userId} is already playing another match in this stage`,
        );
      }
    }

    match.playerAId = nextPlayerAId;
    match.playerBId = nextPlayerBId;
    return this.matchRepository.save(match);
  }

  // Admin disqualifies a player from a LIVE match (2026-08-31, explicit user
  // decision) — blocks them from submitting further answers (see
  // submitAnswer()), but the match itself keeps running: the opponent still
  // has to answer the remaining questions, and the final result is computed
  // normally when it closes (the disqualified player's un-answered questions
  // just score 0, same as anyone not answering a specific question — no new
  // scoring logic needed). Reversible via reinstatePlayer().
  async disqualifyPlayer(
    eventId: string,
    matchId: string,
    requesterId: string,
    dto: DisqualifyPlayerDto,
  ): Promise<Match> {
    const match = await this.getMatchOrThrow(eventId, matchId);
    if (match.status !== MatchStatus.IN_PROGRESS) {
      throw new ConflictException(
        `Cannot disqualify a player from a match with status "${match.status}" — only a live match`,
      );
    }
    if (dto.playerId !== match.playerAId && dto.playerId !== match.playerBId) {
      throw new BadRequestException(
        `User #${dto.playerId} is not a participant of this match`,
      );
    }

    match.disqualifiedPlayerId = dto.playerId;
    const saved = await this.matchRepository.save(match);

    await this.chatMessageRepository.save(
      this.chatMessageRepository.create({
        matchId: match.id,
        questionId: null,
        authorId: requesterId,
        text: `[System] Player #${dto.playerId} disqualified by admin.`,
      }),
    );

    return saved;
  }

  // Undoes a disqualification. While the match is still in_progress, this is
  // just clearing the flag. If the match already closed in the meantime (the
  // opponent finished, or it auto-walked-over), there's no partial undo —
  // this falls back to the existing reopen() flow (Fase 10): full reset,
  // admin reschedules and re-confirms participants/referee from scratch.
  // (2026-08-31, explicit user decision.)
  async reinstatePlayer(
    eventId: string,
    matchId: string,
    requesterId: string,
  ): Promise<Match> {
    const match = await this.getMatchOrThrow(eventId, matchId);
    if (!match.disqualifiedPlayerId) {
      throw new BadRequestException(
        'This match has no disqualified player to reinstate',
      );
    }

    if (match.status === MatchStatus.IN_PROGRESS) {
      match.disqualifiedPlayerId = null;
      const saved = await this.matchRepository.save(match);
      await this.chatMessageRepository.save(
        this.chatMessageRepository.create({
          matchId: match.id,
          questionId: null,
          authorId: requesterId,
          text: '[System] Disqualification reversed by admin — match continues.',
        }),
      );
      return saved;
    }

    if (
      match.status === MatchStatus.CLOSED ||
      match.status === MatchStatus.WALKOVER
    ) {
      await this.reopen(eventId, matchId, requesterId, {
        reason: 'Disqualification reversed by admin — match reset',
      });
      const reopened = await this.getMatchOrThrow(eventId, matchId);
      reopened.disqualifiedPlayerId = null;
      return this.matchRepository.save(reopened);
    }

    throw new ConflictException(
      `Cannot reinstate a player on a match with status "${match.status}"`,
    );
  }

  // Admin cancels a match — it will never be played (2026-08-31, explicit
  // user decision: "simplemente dejalo en estado cancelado... ese match no
  // se dará por tanto los participantes no podrán entrar ahí"). Allowed from
  // `expired` (can't be played in its window, don't want to reschedule it)
  // or `in_progress` (needs to stop a live one) — NOT `pending` (2026-08-31,
  // explicit user correction: a pending match is meant to be *edited*
  // — editParticipants/setReferee/reschedule — not cancelled; cancel doesn't
  // add anything there). Never once it's already terminal
  // (closed/walkover/cancelled — reopen covers correcting those).
  // `start()` already rejects anything but `pending`, so this alone blocks
  // players from ever (re)entering it. Deliberately does NOT touch bracket
  // advancement — same limitation as the admin override/reopen: if this
  // leaves a stage short a winner, the admin fixes it by hand.
  async cancelMatch(eventId: string, matchId: string): Promise<Match> {
    const match = await this.getMatchOrThrow(eventId, matchId);
    if (
      match.status !== MatchStatus.EXPIRED &&
      match.status !== MatchStatus.IN_PROGRESS
    ) {
      throw new ConflictException(
        `Cannot cancel a match with status "${match.status}"`,
      );
    }

    match.status = MatchStatus.CANCELLED;
    return this.matchRepository.save(match);
  }

  // Fase 10 — admin corrects one answer's AI score, based on what was
  // discussed in the dispute chat. Only on already-closed matches
  // (closed/walkover) — nothing to correct on one still in progress.
  // Recalculates the entire match result (the correction can change
  // quality/velocity for BOTH players) and the ranking ledger. Doesn't
  // propagate the change to stages already drawn from the old winner, if
  // the override changes who won — that's left to the admin by hand
  // (editParticipants on the next match, if it's still pending).
  async overrideAnswerScore(
    eventId: string,
    matchId: string,
    answerId: string,
    requesterId: string,
    dto: OverrideAnswerScoreDto,
  ): Promise<Answer> {
    const match = await this.getMatchOrThrow(eventId, matchId);
    if (
      match.status !== MatchStatus.CLOSED &&
      match.status !== MatchStatus.WALKOVER
    ) {
      throw new ConflictException(
        `Cannot override a score for a match with status "${match.status}"`,
      );
    }

    const answer = await this.answerRepository.findOne({
      where: { id: answerId, matchId },
    });
    if (!answer) {
      throw new NotFoundException(`Answer #${answerId} not found`);
    }

    answer.adminOverrideScore = dto.score;
    answer.overrideReason = dto.reason;
    answer.overriddenBy = requesterId;
    answer.overriddenAt = new Date();
    await this.answerRepository.save(answer);

    await this.matchScoringService.computeMatchResult(match);
    const saved = await this.matchRepository.save(match);

    const stage = await this.stageRepository.findOne({
      where: { id: match.stageId },
    });
    if (stage) {
      await this.rankingService.recordMatchResult(saved, stage.eventId);
    }

    return answer;
  }

  // Fase 10 — repeats a closed match from scratch (e.g. plagiarism detected
  // post-match, or any other serious dispute reason). Clears answers,
  // generated questions, score and winner; goes back to `pending`. Admin
  // can then change participants (editParticipants, unlocked again once
  // pending) and reschedule it (schedule, which generates new questions).
  // Doesn't propagate to stages already drawn from the old result — manual
  // admin correction if needed.
  async reopen(
    eventId: string,
    matchId: string,
    requesterId: string,
    dto: ReopenMatchDto,
  ): Promise<Match> {
    const match = await this.getMatchOrThrow(eventId, matchId);
    if (
      match.status !== MatchStatus.CLOSED &&
      match.status !== MatchStatus.WALKOVER
    ) {
      throw new ConflictException(
        `Cannot reopen a match with status "${match.status}"`,
      );
    }

    await this.rankingService.clearMatchResult(match.id);
    await this.answerRepository.delete({ matchId: match.id });
    await this.matchQuestionRepository.delete({ matchId: match.id });

    match.status = MatchStatus.PENDING;
    match.winnerId = null;
    match.scoreA = null;
    match.scoreB = null;
    match.startedAt = null;
    match.endedAt = null;
    match.scheduledStartAt = null;
    match.scheduledEndAt = null;
    match.currentQuestionPosition = null;
    match.currentQuestionDeadline = null;
    const saved = await this.matchRepository.save(match);

    await this.chatMessageRepository.save(
      this.chatMessageRepository.create({
        matchId: match.id,
        questionId: null,
        authorId: requesterId,
        text: `[System] Match reopened by admin. Reason: ${dto.reason}`,
      }),
    );

    return saved;
  }

  // Admin or referee — never before the agreed time, no limit on how much
  // later (see CLAUDE.md). No longer generates questions here (that happens
  // at scheduling) — just activates the already-generated question set and
  // starts the first one's timer.
  async start(eventId: string, matchId: string): Promise<Match> {
    const match = await this.getMatchOrThrow(eventId, matchId);
    if (match.status !== MatchStatus.PENDING) {
      throw new ConflictException(
        `Cannot start a match with status "${match.status}"`,
      );
    }
    if (!match.scheduledStartAt) {
      throw new ConflictException('Match has no scheduled start time yet');
    }
    if (new Date() < match.scheduledStartAt) {
      throw new ConflictException(
        'Cannot start a match before its scheduled start time',
      );
    }
    // Don't rely solely on expireOverdueMatches (runs once a minute) — check
    // the deadline here too, so start() can't win a race against a cron tick
    // that hasn't run yet.
    if (match.scheduledEndAt && new Date() > match.scheduledEndAt) {
      throw new ConflictException(
        'Cannot start a match after its scheduled end time — it has expired, reschedule it',
      );
    }

    const questions = await this.matchQuestionRepository.find({
      where: { matchId: match.id },
      order: { position: 'ASC' },
    });
    const firstQuestion = questions.find((question) => question.position === 1);
    if (!firstQuestion) {
      throw new ConflictException(
        'Match has no questions generated yet — schedule it to generate them',
      );
    }
    await this.assertScoreBudget(eventId, questions);

    firstQuestion.activatedAt = new Date();
    await this.matchQuestionRepository.save(firstQuestion);

    match.status = MatchStatus.IN_PROGRESS;
    match.startedAt = new Date();
    match.currentQuestionPosition = 1;
    match.currentQuestionDeadline = new Date(
      Date.now() + firstQuestion.timeLimit * 1000,
    );
    return this.matchRepository.save(match);
  }

  // Admin or referee — can close it earlier than estimated if it finished
  // fast; the dispute chat stays open after this, it doesn't block it.
  async end(eventId: string, matchId: string): Promise<Match> {
    const match = await this.getMatchOrThrow(eventId, matchId);
    if (match.status !== MatchStatus.IN_PROGRESS) {
      throw new ConflictException(
        `Cannot end a match with status "${match.status}"`,
      );
    }
    await this.evaluateCurrentQuestion(match);
    return this.closeMatch(match);
  }

  // Player submits their answer to the match's active question.
  async submitAnswer(
    eventId: string,
    matchId: string,
    playerId: string,
    dto: SubmitAnswerDto,
  ): Promise<Answer> {
    const match = await this.getMatchOrThrow(eventId, matchId);
    this.assertIsParticipant(match, playerId);
    if (match.disqualifiedPlayerId === playerId) {
      throw new ForbiddenException(
        'You have been disqualified from this match',
      );
    }
    if (match.status !== MatchStatus.IN_PROGRESS) {
      throw new ConflictException('Match is not in progress');
    }
    if (!match.currentQuestionPosition || !match.currentQuestionDeadline) {
      throw new ConflictException('Match has no active question right now');
    }
    if (new Date() > match.currentQuestionDeadline) {
      throw new ConflictException('Time is up for this question');
    }

    const matchQuestion = await this.matchQuestionRepository.findOne({
      where: { matchId: match.id, position: match.currentQuestionPosition },
    });
    if (!matchQuestion) {
      throw new ConflictException('Match has no active question right now');
    }

    const answer = this.answerRepository.create({
      matchId: match.id,
      questionId: matchQuestion.id,
      playerId,
      answerText: dto.answerText,
    });
    let saved: Answer;
    try {
      saved = await this.answerRepository.save(answer);
    } catch (error) {
      if ((error as { code?: string }).code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException('You already answered this question');
      }
      throw error;
    }

    const answerCount = await this.answerRepository.count({
      where: { matchId: match.id, questionId: matchQuestion.id },
    });
    if (answerCount >= 2) {
      await this.advanceQuestion(match);
    }

    return saved;
  }

  // Only the match's two players — never the rubric/expected answer.
  async getCurrentQuestion(
    eventId: string,
    matchId: string,
    playerId: string,
  ): Promise<CurrentQuestionView> {
    const match = await this.getMatchOrThrow(eventId, matchId);
    this.assertIsParticipant(match, playerId);
    if (match.status !== MatchStatus.IN_PROGRESS) {
      throw new ConflictException('Match is not in progress');
    }
    if (!match.currentQuestionPosition) {
      throw new ConflictException('Match has no active question right now');
    }

    const matchQuestion = await this.matchQuestionRepository.findOne({
      where: { matchId: match.id, position: match.currentQuestionPosition },
    });
    if (!matchQuestion) {
      throw new ConflictException('Match has no active question right now');
    }

    const totalQuestions = await this.matchQuestionRepository.count({
      where: { matchId: match.id },
    });
    const opponentId =
      playerId === match.playerAId ? match.playerBId : match.playerAId;

    const [youAnswered, opponentAnswered] = await Promise.all([
      this.answerRepository.exists({
        where: { matchId: match.id, questionId: matchQuestion.id, playerId },
      }),
      opponentId
        ? this.answerRepository.exists({
            where: {
              matchId: match.id,
              questionId: matchQuestion.id,
              playerId: opponentId,
            },
          })
        : Promise.resolve(false),
    ]);

    return {
      position: match.currentQuestionPosition,
      totalQuestions,
      questionText: matchQuestion.text,
      timeLimit: matchQuestion.timeLimit,
      deadline: match.currentQuestionDeadline,
      youAnswered,
      opponentAnswered,
    };
  }

  // After the match closes, both players see both answers side by side
  // (see CLAUDE.md); admin/referee can see them at any time.
  async getAnswers(
    eventId: string,
    matchId: string,
    requester: AuthenticatedUser,
  ): Promise<Answer[]> {
    const match = await this.getMatchOrThrow(eventId, matchId);
    const isParticipant =
      requester.id === match.playerAId || requester.id === match.playerBId;
    const isStaff =
      requester.role === UserRole.ADMIN || requester.role === UserRole.REFEREE;
    if (!isParticipant && !isStaff) {
      throw new ForbiddenException('Not a participant of this match');
    }
    if (
      isParticipant &&
      !isStaff &&
      match.status !== MatchStatus.CLOSED &&
      match.status !== MatchStatus.WALKOVER
    ) {
      throw new ConflictException(
        'Answers are visible once the match is closed',
      );
    }

    return this.answerRepository.find({
      where: { matchId: match.id },
      order: { submittedAt: 'ASC' },
    });
  }

  // Admin/referee see one match's full question set (with rubric) —
  // maintenance/correction, not what the player sees.
  async findQuestionsForMatch(
    eventId: string,
    matchId: string,
  ): Promise<MatchQuestion[]> {
    await this.getMatchOrThrow(eventId, matchId);
    return this.matchQuestionRepository.find({
      where: { matchId },
      order: { position: 'ASC' },
    });
  }

  async findOneQuestion(
    eventId: string,
    matchId: string,
    questionId: string,
  ): Promise<MatchQuestion> {
    await this.getMatchOrThrow(eventId, matchId);
    const question = await this.matchQuestionRepository.findOne({
      where: { id: questionId, matchId },
    });
    if (!question) {
      throw new NotFoundException(`Question #${questionId} not found`);
    }
    return question;
  }

  // Content/score correction, while the match hasn't started. A maxScore
  // change must still fit the event's budget alongside every other question.
  async updateQuestion(
    eventId: string,
    matchId: string,
    questionId: string,
    dto: UpdateMatchQuestionDto,
  ): Promise<MatchQuestion> {
    const match = await this.getMatchOrThrow(eventId, matchId);
    if (match.status !== MatchStatus.PENDING) {
      throw new ConflictException(
        `Cannot edit questions of a match with status "${match.status}"`,
      );
    }
    const question = await this.findOneQuestion(eventId, matchId, questionId);

    if (dto.maxScore !== undefined) {
      const others = await this.matchQuestionRepository.find({
        where: { matchId },
      });
      await this.assertWithinBudget(
        eventId,
        others.filter((other) => other.id !== questionId),
        dto.maxScore,
      );
    }

    Object.assign(question, dto);
    return this.matchQuestionRepository.save(question);
  }

  // Manual addition to the batch (admin) — while the match hasn't started
  // and there's still budget left under the event's maxScorePerMatch.
  async createQuestion(
    eventId: string,
    matchId: string,
    dto: CreateMatchQuestionDto,
  ): Promise<MatchQuestion> {
    const match = await this.getMatchOrThrow(eventId, matchId);
    if (match.status !== MatchStatus.PENDING) {
      throw new ConflictException(
        `Cannot add questions to a match with status "${match.status}"`,
      );
    }

    const existing = await this.matchQuestionRepository.find({
      where: { matchId },
      order: { position: 'ASC' },
    });
    await this.assertWithinBudget(eventId, existing, dto.maxScore);

    const question = this.matchQuestionRepository.create({
      matchId,
      position: existing.length + 1,
      text: dto.text,
      rubric: dto.rubric,
      maxScore: dto.maxScore,
      timeLimit: dto.timeLimit,
    });
    return this.matchQuestionRepository.save(question);
  }

  // Removes one question from the batch (admin) — while the match hasn't
  // started, and only if at least one question would remain.
  async deleteQuestion(
    eventId: string,
    matchId: string,
    questionId: string,
  ): Promise<void> {
    const match = await this.getMatchOrThrow(eventId, matchId);
    if (match.status !== MatchStatus.PENDING) {
      throw new ConflictException(
        `Cannot remove questions from a match with status "${match.status}"`,
      );
    }

    const existing = await this.matchQuestionRepository.find({
      where: { matchId },
      order: { position: 'ASC' },
    });
    if (!existing.some((question) => question.id === questionId)) {
      throw new NotFoundException(`Question #${questionId} not found`);
    }
    if (existing.length === 1) {
      throw new ConflictException('Cannot remove the last question of a match');
    }

    const remaining = existing.filter((question) => question.id !== questionId);
    await this.matchQuestionRepository.delete({ id: questionId, matchId });
    // Re-sequence so positions stay contiguous 1..N — start() looks up
    // position 1 specifically, and gaps would break that after a mid-batch delete.
    await Promise.all(
      remaining.map((question, index) =>
        question.position === index + 1
          ? Promise.resolve()
          : this.matchQuestionRepository.update(question.id, {
              position: index + 1,
            }),
      ),
    );
  }

  // A question set may sit under budget while being edited (nothing forces
  // filling it immediately), but must never go OVER it — and must land on
  // EXACTLY the budget before the match can start (enforced in start()).
  private async assertWithinBudget(
    eventId: string,
    otherQuestions: MatchQuestion[],
    candidateScore: number,
  ): Promise<void> {
    const event = await this.tournamentRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event #${eventId} not found`);
    }
    const budget = Number(event.maxScorePerMatch);
    const othersTotal = otherQuestions.reduce(
      (sum, question) => sum + Number(question.maxScore),
      0,
    );
    const nextTotal = round2(othersTotal + candidateScore);
    if (nextTotal > budget) {
      throw new ConflictException(
        `This would bring the match's total to ${nextTotal}, over the event's ${budget}-point budget (currently ${round2(othersTotal)} used).`,
      );
    }
  }

  // Called right before a match starts — the one point where the total is
  // required to be exact, not just "not over".
  private async assertScoreBudget(
    eventId: string,
    questions: MatchQuestion[],
  ): Promise<void> {
    const event = await this.tournamentRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event #${eventId} not found`);
    }
    const budget = Number(event.maxScorePerMatch);
    const total = round2(
      questions.reduce((sum, question) => sum + Number(question.maxScore), 0),
    );
    if (Math.abs(total - budget) > 0.01) {
      throw new ConflictException(
        `Questions must add up to exactly ${budget} points before starting the match (currently ${total}).`,
      );
    }
  }

  // Nobody started it before the estimated end time — no scores, admin
  // has to reschedule it by hand (see CLAUDE.md).
  @Cron(CronExpression.EVERY_MINUTE)
  async expireOverdueMatches(): Promise<void> {
    await this.matchRepository.update(
      {
        status: MatchStatus.PENDING,
        scheduledEndAt: LessThan(new Date()),
      },
      { status: MatchStatus.EXPIRED },
    );
  }

  // Question timer without Redis (MVP): if nobody else answers before the
  // deadline, it still advances to the next one (or closes if it was the last).
  @Cron(CronExpression.EVERY_10_SECONDS)
  async advanceOverdueQuestions(): Promise<void> {
    const overdueMatches = await this.matchRepository.find({
      where: {
        status: MatchStatus.IN_PROGRESS,
        currentQuestionDeadline: LessThan(new Date()),
      },
    });
    for (const match of overdueMatches) {
      await this.advanceQuestion(match);
    }
  }

  private assertIsParticipant(match: Match, playerId: string): void {
    if (playerId !== match.playerAId && playerId !== match.playerBId) {
      throw new ForbiddenException('Not a participant of this match');
    }
  }

  private async evaluateCurrentQuestion(match: Match): Promise<void> {
    if (!match.currentQuestionPosition) return;
    const currentMatchQuestion = await this.matchQuestionRepository.findOne({
      where: { matchId: match.id, position: match.currentQuestionPosition },
    });
    if (currentMatchQuestion) {
      await this.matchScoringService.evaluateQuestion(currentMatchQuestion);
    }
  }

  private async advanceQuestion(match: Match): Promise<Match> {
    await this.evaluateCurrentQuestion(match);

    const totalQuestions = await this.matchQuestionRepository.count({
      where: { matchId: match.id },
    });
    const nextPosition = (match.currentQuestionPosition ?? 0) + 1;
    if (nextPosition > totalQuestions) {
      return this.closeMatch(match);
    }

    const nextMatchQuestion = await this.matchQuestionRepository.findOne({
      where: { matchId: match.id, position: nextPosition },
    });
    if (!nextMatchQuestion) {
      return this.closeMatch(match);
    }

    nextMatchQuestion.activatedAt = new Date();
    await this.matchQuestionRepository.save(nextMatchQuestion);

    match.currentQuestionPosition = nextPosition;
    match.currentQuestionDeadline = new Date(
      Date.now() + nextMatchQuestion.timeLimit * 1000,
    );
    return this.matchRepository.save(match);
  }

  // Walkover if exactly one of the two answered NONE of the match's
  // questions (see CLAUDE.md). Actual score/winner are computed here (the
  // per-question AI evaluator already ran in advanceQuestion — this just
  // applies the final 70/30 formula over what's already scored).
  private async closeMatch(match: Match): Promise<Match> {
    const [answersFromA, answersFromB] = await Promise.all([
      match.playerAId
        ? this.answerRepository.count({
            where: { matchId: match.id, playerId: match.playerAId },
          })
        : Promise.resolve(0),
      match.playerBId
        ? this.answerRepository.count({
            where: { matchId: match.id, playerId: match.playerBId },
          })
        : Promise.resolve(0),
    ]);
    const absentCount = [answersFromA, answersFromB].filter(
      (count) => count === 0,
    ).length;

    match.status =
      absentCount === 1 ? MatchStatus.WALKOVER : MatchStatus.CLOSED;
    match.endedAt = new Date();
    match.currentQuestionDeadline = null;

    await this.matchScoringService.computeMatchResult(match);
    const saved = await this.matchRepository.save(match);

    const stage = await this.stageRepository.findOne({
      where: { id: match.stageId },
    });
    if (stage) {
      await this.rankingService
        .recordMatchResult(saved, stage.eventId)
        .catch((error) => {
          this.logger.error(
            `recordMatchResult failed for match ${match.id}: ${(error as Error).message}`,
          );
        });
    }

    // If this was the stage's last pending match, draws the next stage(s)
    // with real winners (see StageService). Must not block the match's
    // closing if it fails.
    await this.stageService.checkAndAdvance(match.stageId).catch((error) => {
      this.logger.error(
        `checkAndAdvance failed for stage ${match.stageId}: ${(error as Error).message}`,
      );
    });

    return saved;
  }

  private async getMatchOrThrow(
    eventId: string,
    matchId: string,
  ): Promise<Match> {
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
    });
    if (!match) {
      throw new NotFoundException(`Match #${matchId} not found`);
    }
    const stage = await this.stageRepository.findOne({
      where: { id: match.stageId },
    });
    if (!stage || stage.eventId !== eventId) {
      throw new NotFoundException(`Match #${matchId} not found`);
    }
    return match;
  }
}
