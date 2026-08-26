import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
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
@Controller('tournament/events/:eventId/matches')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Get(':matchId')
  findOne(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
  ) {
    return this.matchService.findOne(eventId, matchId);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':matchId/schedule')
  schedule(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @Body() dto: ScheduleMatchDto,
  ) {
    return this.matchService.schedule(eventId, matchId, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':matchId/participants')
  editParticipants(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @Body() dto: EditParticipantsDto,
  ) {
    return this.matchService.editParticipants(eventId, matchId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.REFEREE)
  @Post(':matchId/start')
  start(@Param('eventId') eventId: string, @Param('matchId') matchId: string) {
    return this.matchService.start(eventId, matchId);
  }

  @Roles(UserRole.ADMIN, UserRole.REFEREE)
  @Post(':matchId/end')
  end(@Param('eventId') eventId: string, @Param('matchId') matchId: string) {
    return this.matchService.end(eventId, matchId);
  }

  @Roles(UserRole.PLAYER)
  @Get(':matchId/current-question')
  getCurrentQuestion(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.matchService.getCurrentQuestion(eventId, matchId, user.id);
  }

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

  @Get(':matchId/answers')
  getAnswers(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.matchService.getAnswers(eventId, matchId, user);
  }

  @Roles(UserRole.ADMIN, UserRole.REFEREE)
  @Get(':matchId/questions')
  findQuestions(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
  ) {
    return this.matchService.findQuestionsForMatch(eventId, matchId);
  }

  @Roles(UserRole.ADMIN, UserRole.REFEREE)
  @Get(':matchId/questions/:questionId')
  findOneQuestion(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.matchService.findOneQuestion(eventId, matchId, questionId);
  }

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
