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
import { EditParticipantsDto } from './dto/edit-participants.dto';
import { OverrideAnswerScoreDto } from './dto/override-answer-score.dto';
import { ReopenMatchDto } from './dto/reopen-match.dto';
import { ScheduleMatchDto } from './dto/schedule-match.dto';
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
import { DisputeChatMessage } from '../dispute-chat/entities/dispute-chat-message.entity';
import { UserRole } from '../auth/entities/user.entity';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

const PG_UNIQUE_VIOLATION = '23505';

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
    private readonly matchQuestionGenerationService: MatchQuestionGenerationService,
    private readonly matchScoringService: MatchScoringService,
    private readonly stageService: StageService,
    private readonly rankingService: RankingService,
  ) {}

  async findOne(eventId: string, matchId: string): Promise<Match> {
    return this.getMatchOrThrow(eventId, matchId);
  }

  // Admin fija u actualiza la programación — permitido mientras el match no
  // haya arrancado, o para reagendar uno que expiró sin jugarse. Genera (o
  // regenera, si ya tenía) el cuestionario propio de este match por IA —
  // sin banco compartido, cada match saca sus preguntas al agendarse, no al
  // arrancar. Si la IA falla, no se guarda el reagendado tampoco (se valida
  // y genera ANTES de tocar la hora).
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

    const scheduledStartAt = new Date(dto.scheduledStartAt);
    const scheduledEndAt = new Date(dto.scheduledEndAt);
    if (scheduledEndAt <= scheduledStartAt) {
      throw new BadRequestException(
        'scheduledEndAt must be after scheduledStartAt',
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

  // Admin cambia uno o los dos participantes — solo antes de que arranque
  // (ej. algo surgió en el chat y hay que corregir el cruce). Corrección
  // post-match (descalificación/sustitución/repetir un match cerrado) queda
  // para cuando exista el flujo completo de puntaje (ver CLAUDE.md Fase 10).
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

  // Fase 10 — admin corrige el puntaje IA de una respuesta puntual, a partir
  // de lo discutido en el chat de reclamos. Solo sobre matches ya cerrados
  // (closed/walkover) — nada que corregir en uno que sigue en curso.
  // Recalcula el resultado del match entero (la corrección puede cambiar
  // calidad/velocidad de AMBOS jugadores) y el ledger de ranking. No
  // propaga el cambio a fases ya sorteadas a partir del ganador viejo, si
  // el override cambia quién ganó — eso queda a mano del admin
  // (editParticipants en el match siguiente, si sigue pending).
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

  // Fase 10 — repite un match cerrado desde cero (ej. plagio detectado
  // post-match, o cualquier otro motivo de disputa grave). Limpia
  // respuestas, preguntas generadas, puntaje y ganador; vuelve a `pending`.
  // El admin puede después cambiar participantes (editParticipants, ya
  // desbloqueado al volver a pending) y reagendarlo (schedule, que genera
  // preguntas nuevas). No propaga a fases ya sorteadas a partir del
  // resultado viejo — corrección manual del admin si hace falta.
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
        text: `[Sistema] Match reabierto por admin. Motivo: ${dto.reason}`,
      }),
    );

    return saved;
  }

  // Admin o árbitro — nunca antes de la hora pactada, sin límite de cuánto
  // después (ver CLAUDE.md). Ya no genera preguntas acá (eso pasa al
  // agendar) — solo activa el cuestionario ya generado y arranca el timer
  // de la primera.
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

    const firstQuestion = await this.matchQuestionRepository.findOne({
      where: { matchId: match.id, position: 1 },
    });
    if (!firstQuestion) {
      throw new ConflictException(
        'Match has no questions generated yet — reschedule it to generate them',
      );
    }

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

  // Admin o árbitro — puede cerrarlo antes de lo estimado si terminó rápido;
  // el chat de reclamos sigue abierto después de esto, no lo bloquea.
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

  // Jugador envía su respuesta a la pregunta activa del match.
  async submitAnswer(
    eventId: string,
    matchId: string,
    playerId: string,
    dto: SubmitAnswerDto,
  ): Promise<Answer> {
    const match = await this.getMatchOrThrow(eventId, matchId);
    this.assertIsParticipant(match, playerId);
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

  // Solo los dos jugadores del match — nunca la rúbrica/respuesta esperada.
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

  // Tras cerrar el match, ambos jugadores ven las dos respuestas lado a
  // lado (ver CLAUDE.md); admin/árbitro pueden verlas en cualquier momento.
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

  // Admin/árbitro ven el cuestionario completo (con rúbrica) de un match
  // puntual — mantenimiento/corrección, no lo que ve el jugador.
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

  // Solo corrección de contenido, mientras el match no arrancó — no se
  // agrega ni se saca una pregunta del lote (ver CLAUDE.md).
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
    Object.assign(question, dto);
    return this.matchQuestionRepository.save(question);
  }

  // Nadie lo arrancó antes de la hora de fin estimada — sin puntajes, admin
  // tiene que reagendarlo a mano (ver CLAUDE.md).
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

  // Timer de pregunta sin Redis (MVP): si nadie más responde antes del
  // deadline, igual avanza a la siguiente (o cierra si era la última).
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

  // Walkover si exactamente uno de los dos no respondió NINGUNA pregunta del
  // match (ver CLAUDE.md). Puntaje/ganador real se calculan acá (evaluador
  // IA por pregunta ya corrió en advanceQuestion — esto solo agrega la
  // fórmula final 70/30 sobre lo ya puntuado).
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

    // Si esta era la última partida pendiente de la fase, sortea la/las
    // fases siguientes con ganadores reales (ver StageService). No debe
    // tumbar el cierre del match si falla.
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
