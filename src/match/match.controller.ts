import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateMatchQuestionDto } from './dto/create-match-question.dto';
import { DisqualifyPlayerDto } from './dto/disqualify-player.dto';
import { EditParticipantsDto } from './dto/edit-participants.dto';
import { OverrideAnswerScoreDto } from './dto/override-answer-score.dto';
import { ReopenMatchDto } from './dto/reopen-match.dto';
import { ScheduleMatchDto } from './dto/schedule-match.dto';
import { SetMatchRefereeDto } from './dto/set-match-referee.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { UpdateMatchQuestionDto } from './dto/update-match-question.dto';
import { MatchService } from './match.service';

// GET    /tournament/events/:eventId/matches/:matchId               — authenticated
// PATCH  /tournament/events/:eventId/matches/:matchId/schedule      — admin, sets start time + duration AND generates/regenerates the match's questions via AI
// PATCH  /tournament/events/:eventId/matches/:matchId/referee       — admin, assigns/changes the referee (manual, pre-match only)
// PATCH  /tournament/events/:eventId/matches/:matchId/participants  — admin, pre-match only
// POST   /tournament/events/:eventId/matches/:matchId/disqualify    — admin, live match only, blocks that player's answers
// POST   /tournament/events/:eventId/matches/:matchId/reinstate     — admin, undoes a disqualification (only while in_progress — final once closed)
// POST   /tournament/events/:eventId/matches/:matchId/cancel        — admin, expired/in_progress only (edit a pending one instead) — the match will never be played
// POST   /tournament/events/:eventId/matches/:matchId/start         — admin or referee
// POST   /tournament/events/:eventId/matches/:matchId/end           — admin or referee
// GET    /tournament/events/:eventId/matches/:matchId/current-question — player (only the match's 2)
// POST   /tournament/events/:eventId/matches/:matchId/answers          — player (only the match's 2)
// GET    /tournament/events/:eventId/matches/:matchId/answers          — participants (only after closing) or admin/referee
// GET    /tournament/events/:eventId/matches/:matchId/questions        — admin/referee, full question set (with rubric)
// POST   /tournament/events/:eventId/matches/:matchId/questions        — admin, add one question, pre-match only, must fit the score budget
// GET    /tournament/events/:eventId/matches/:matchId/questions/:id    — admin/referee
// PATCH  /tournament/events/:eventId/matches/:matchId/questions/:id    — admin, content/score correction, pre-match only
// DELETE /tournament/events/:eventId/matches/:matchId/questions/:id    — admin, remove one question, pre-match only, keeps at least one
// PATCH  /tournament/events/:eventId/matches/:matchId/answers/:answerId/override — admin, Fase 10, post-match only
// POST   /tournament/events/:eventId/matches/:matchId/reopen                    — admin, Fase 10, repeats the match from scratch
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
      "Sets scheduledStartAt + durationMinutes (scheduledEndAt is computed) and generates (or, if it already had one, regenerates from scratch) this match's question set via AI (Moonshot/Kimi). Requires MOONSHOT_API_KEY.",
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
    summary: 'Assign or change the match referee (admin)',
    description:
      'Manual only — no auto-pick, no calendar/time-slot check. Same pre-match gate as editing participants (match must be "pending").',
  })
  @ApiParam({ name: 'matchId' })
  @Roles(UserRole.ADMIN)
  @Patch(':matchId/referee')
  setReferee(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @Body() dto: SetMatchRefereeDto,
  ) {
    return this.matchService.setReferee(eventId, matchId, dto);
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
    summary: 'Disqualify a player from a live match (admin)',
    description:
      'Blocks that player from submitting further answers — the match keeps running for the opponent, closes normally when it\'s done. Only on a match with status "in_progress".',
  })
  @ApiParam({ name: 'matchId' })
  @Roles(UserRole.ADMIN)
  @Post(':matchId/disqualify')
  disqualifyPlayer(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @Body() dto: DisqualifyPlayerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.matchService.disqualifyPlayer(eventId, matchId, user.id, dto);
  }

  @ApiOperation({
    summary: 'Reinstate a disqualified player (admin)',
    description:
      'Only works while the match is still in_progress — clears the disqualification and the match continues normally. Once the match has closed (closed/walkover), the disqualification is final for this event — this returns 409, no path back in for that player this tournament.',
  })
  @ApiParam({ name: 'matchId' })
  @Roles(UserRole.ADMIN)
  @Post(':matchId/reinstate')
  reinstatePlayer(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.matchService.reinstatePlayer(eventId, matchId, user.id);
  }

  @ApiOperation({
    summary: 'Cancel a match (admin)',
    description:
      'It will never be played — start() rejects anything but "pending". Allowed from "expired" or "in_progress" only — a "pending" match should be edited instead (participants/referee/reschedule), not cancelled. Never once it\'s already terminal (closed/walkover/cancelled). Does NOT touch bracket advancement — if this leaves a stage short a winner, fix it by hand.',
  })
  @ApiParam({ name: 'matchId' })
  @Roles(UserRole.ADMIN)
  @Post(':matchId/cancel')
  cancelMatch(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
  ) {
    return this.matchService.cancelMatch(eventId, matchId);
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

  @ApiOperation({
    summary: 'Add one question to the match (admin)',
    description:
      "Pre-match only. Rejected if it would push the batch's total maxScore over the event's maxScorePerMatch budget.",
  })
  @ApiParam({ name: 'matchId' })
  @Roles(UserRole.ADMIN)
  @Post(':matchId/questions')
  createQuestion(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @Body() dto: CreateMatchQuestionDto,
  ) {
    return this.matchService.createQuestion(eventId, matchId, dto);
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
    summary: "Correct a question's content or score (admin)",
    description:
      'Pre-match only. A maxScore change is rejected if it would push the total over budget.',
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
    summary: 'Remove one question from the match (admin)',
    description:
      'Pre-match only. Rejected if it would remove the last remaining question.',
  })
  @ApiParam({ name: 'matchId' })
  @ApiParam({ name: 'questionId' })
  @ApiNoContentResponse()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':matchId/questions/:questionId')
  deleteQuestion(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.matchService.deleteQuestion(eventId, matchId, questionId);
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
      "Resets to pending, clearing answers/questions/scores/ranking for this match. Does not cascade into stages already drawn from the old winner. Logged as a system message in the match's dispute chat. Rejects with 409 if the match has a disqualified player — disqualification is final for this event, not even an unrelated reopen (e.g. plagiarism) can bring them back.",
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
