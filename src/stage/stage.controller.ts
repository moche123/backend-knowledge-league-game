import { Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { StageService } from './stage.service';

// POST /tournament/events/:eventId/stages/draw   — admin, closes registration
//   and draws the first stage (creates the event's full stage tree).
// POST /tournament/events/:eventId/stages/cancel — admin, undoes the draw entirely
//   (in_progress only), resets the event back to registration_open.
// POST /tournament/events/:eventId/stages/:stageId/redraw — admin, re-shuffles
//   ONE already-drawn stage's matchups (new seed) — only while every match
//   in it is still pending.
// GET  /tournament/events/:eventId/stages       — authenticated, view the bracket.
@ApiTags('stages')
@ApiBearerAuth('access-token')
@ApiParam({ name: 'eventId', description: 'Event id' })
@Controller('tournament/events/:eventId/stages')
export class StageController {
  constructor(private readonly stageService: StageService) {}

  @ApiOperation({
    summary: 'Close registration and draw the first stage (admin)',
    description:
      'Builds the full stage tree for the event and draws the first one with a verifiable random seed. Requires exactly maxPlayers registrations.',
  })
  @Roles(UserRole.ADMIN)
  @Post('draw')
  drawFirstStage(@Param('eventId') eventId: string) {
    return this.stageService.drawFirstStage(eventId);
  }

  @ApiOperation({
    summary: 'Cancel an in-progress event, undoing the draw (admin)',
    description:
      "Deletes the full bracket (stages, matches, their questions/answers/chat, and this event's ranking entries) and resets the event to registration_open. Registrations are kept.",
  })
  @Roles(UserRole.ADMIN)
  @Post('cancel')
  cancelBracket(@Param('eventId') eventId: string) {
    return this.stageService.cancelBracket(eventId);
  }

  @ApiOperation({
    summary: "Re-shuffle one already-drawn stage's matchups (admin)",
    description:
      'Draws a fresh, verifiable seed for this stage only, keeping the same participant pool. Only while every match in the stage is still pending — once any has started, its result is real and this is rejected (edit participants on individual pending matches instead).',
  })
  @ApiParam({ name: 'stageId' })
  @Roles(UserRole.ADMIN)
  @Post(':stageId/redraw')
  redrawStage(
    @Param('eventId') eventId: string,
    @Param('stageId') stageId: string,
  ) {
    return this.stageService.redrawStage(eventId, stageId);
  }

  @ApiOperation({
    summary: 'List all stages and their matches (the full bracket)',
    description:
      'Later stages (semis, final, third place) draw themselves as prior matches close — re-poll this route to see new pending matches appear.',
  })
  @Get()
  findAll(@Param('eventId') eventId: string) {
    return this.stageService.findAllForEvent(eventId);
  }
}
