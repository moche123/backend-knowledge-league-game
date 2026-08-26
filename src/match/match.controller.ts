import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { EditParticipantsDto } from './dto/edit-participants.dto';
import { OverrideAnswerScoreDto } from './dto/override-answer-score.dto';
import { ReopenMatchDto } from './dto/reopen-match.dto';
import { ScheduleMatchDto } from './dto/schedule-match.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { UpdateMatchQuestionDto } from './dto/update-match-question.dto';
import { MatchService } from './match.service';

// GET   /tournament/events/:eventId/matches/:matchId               — autenticado
// PATCH /tournament/events/:eventId/matches/:matchId/schedule      — admin, genera/regenera las preguntas del match
// PATCH /tournament/events/:eventId/matches/:matchId/participants  — admin, solo pre-match
// POST  /tournament/events/:eventId/matches/:matchId/start         — admin o árbitro
// POST  /tournament/events/:eventId/matches/:matchId/end           — admin o árbitro
// GET   /tournament/events/:eventId/matches/:matchId/current-question — jugador (solo los 2 del match)
// POST  /tournament/events/:eventId/matches/:matchId/answers          — jugador (solo los 2 del match)
// GET   /tournament/events/:eventId/matches/:matchId/answers          — participantes (solo tras cerrar) o admin/árbitro
// GET   /tournament/events/:eventId/matches/:matchId/questions        — admin/árbitro, cuestionario completo (con rúbrica)
// GET   /tournament/events/:eventId/matches/:matchId/questions/:id    — admin/árbitro
// PATCH /tournament/events/:eventId/matches/:matchId/questions/:id    — admin, corrección de contenido, solo pre-match
// PATCH /tournament/events/:eventId/matches/:matchId/answers/:answerId/override — admin, Fase 10, solo post-match
// POST  /tournament/events/:eventId/matches/:matchId/reopen                    — admin, Fase 10, repite el match desde cero
@ApiTags('matches')
@ApiBearerAuth('access-token')
@ApiParam({ name: 'eventId', description: 'Event id' })
@Controller('tournament/events/:eventId/matches')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @ApiOperation({
    summary: 'Get a match',
    description:
      'Includes score_a/score_b/winner_id once the match has closed (closed or walkover) — computed automatically by the 70/30 formula.',
  })
  @ApiParam({ name: 'matchId' })
  @Get(':matchId')
  findOne(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
  ) {
    return this.matchService.findOne(eventId, matchId);
  }

  @ApiOperation({
    summary: 'Schedule or reschedule a match (admin)',
    description:
      "Sets scheduledStartAt/scheduledEndAt and generates (or, if it already had one, regenerates from scratch) this match's question set via AI (Moonshot/Kimi). Requires MOONSHOT_API_KEY.",
  })
  @ApiParam({ name: 'matchId' })
  @Roles(UserRole.ADMIN)
  @Patch(':matchId/schedule')
  schedule(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @Body() dto: ScheduleMatchDto,
  ) {
    return this.matchService.schedule(eventId, matchId, dto);
  }

  @ApiOperation({
    summary: 'Edit one or both participants (admin)',
    description:
      'Only while the match is still pending. The replacement must be registered in the event and not already playing another match of the same stage.',
  })
  @ApiParam({ name: 'matchId' })
  @Roles(UserRole.ADMIN)
  @Patch(':matchId/participants')
  editParticipants(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @Body() dto: EditParticipantsDto,
  ) {
    return this.matchService.editParticipants(eventId, matchId, dto);
  }

  @ApiOperation({
    summary: 'Start a match (admin or referee)',
    description:
      'Fails if scheduledStartAt has not arrived yet, or if the match has no generated questions (schedule it first).',
  })
  @ApiParam({ name: 'matchId' })
  @Roles(UserRole.ADMIN, UserRole.REFEREE)
  @Post(':matchId/start')
  start(@Param('eventId') eventId: string, @Param('matchId') matchId: string) {
    return this.matchService.start(eventId, matchId);
  }

  @ApiOperation({
    summary: 'End a match (admin or referee)',
    description: 'Can close it earlier than the estimated end time.',
  })
  @ApiParam({ name: 'matchId' })
  @Roles(UserRole.ADMIN, UserRole.REFEREE)
  @Post(':matchId/end')
  end(@Param('eventId') eventId: string, @Param('matchId') matchId: string) {
    return this.matchService.end(eventId, matchId);
  }

  @ApiOperation({
    summary: "Get the active question (player, one of the match's two)",
    description:
      'Returns the active question and its deadline, without the rubric.',
  })
  @ApiParam({ name: 'matchId' })
  @Roles(UserRole.PLAYER)
  @Get(':matchId/current-question')
  getCurrentQuestion(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.matchService.getCurrentQuestion(eventId, matchId, user.id);
  }

  @ApiOperation({
    summary:
      "Submit an answer to the active question (player, one of the match's two)",
  })
  @ApiParam({ name: 'matchId' })
  @Roles(UserRole.PLAYER)
  @Post(':matchId/answers')
  submitAnswer(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.matchService.submitAnswer(eventId, matchId, user.id, dto);
  }

  @ApiOperation({
    summary: 'Get all answers for a match',
    description:
      'Players see this only after the match closes; admin/referee any time. Includes ai_score/ai_justification, scored as soon as each question closes.',
  })
  @ApiParam({ name: 'matchId' })
  @Get(':matchId/answers')
  getAnswers(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.matchService.getAnswers(eventId, matchId, user);
  }

  @ApiOperation({
    summary:
      "List the match's full question set, with rubrics (admin or referee)",
  })
  @ApiParam({ name: 'matchId' })
  @Roles(UserRole.ADMIN, UserRole.REFEREE)
  @Get(':matchId/questions')
  findQuestions(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
  ) {
    return this.matchService.findQuestionsForMatch(eventId, matchId);
  }

  @ApiOperation({ summary: 'Get one match question by id (admin or referee)' })
  @ApiParam({ name: 'matchId' })
  @ApiParam({ name: 'questionId' })
  @Roles(UserRole.ADMIN, UserRole.REFEREE)
  @Get(':matchId/questions/:questionId')
  findOneQuestion(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.matchService.findOneQuestion(eventId, matchId, questionId);
  }

  @ApiOperation({
    summary: "Correct a generated question's content (admin)",
    description:
      "Content fix only — questions can't be added or removed from the batch, only while the match is still pending.",
  })
  @ApiParam({ name: 'matchId' })
  @ApiParam({ name: 'questionId' })
  @Roles(UserRole.ADMIN)
  @Patch(':matchId/questions/:questionId')
  updateQuestion(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateMatchQuestionDto,
  ) {
    return this.matchService.updateQuestion(eventId, matchId, questionId, dto);
  }

  @ApiOperation({
    summary: "Override a single answer's score (admin, Fase 10)",
    description:
      'Only on a closed/walkover match — recalculates the entire match result and ranking ledger. Logs who overrode it, when, and why.',
  })
  @ApiParam({ name: 'matchId' })
  @ApiParam({ name: 'answerId' })
  @Roles(UserRole.ADMIN)
  @Patch(':matchId/answers/:answerId/override')
  overrideAnswerScore(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @Param('answerId') answerId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OverrideAnswerScoreDto,
  ) {
    return this.matchService.overrideAnswerScore(
      eventId,
      matchId,
      answerId,
      user.id,
      dto,
    );
  }

  @ApiOperation({
    summary: 'Reopen a closed match from scratch (admin, Fase 10)',
    description:
      "Resets to pending, clearing answers/questions/scores/ranking for this match. Does not cascade into stages already drawn from the old winner. Logged as a system message in the match's dispute chat.",
  })
  @ApiParam({ name: 'matchId' })
  @Roles(UserRole.ADMIN)
  @Post(':matchId/reopen')
  reopen(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReopenMatchDto,
  ) {
    return this.matchService.reopen(eventId, matchId, user.id, dto);
  }
}
