import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { DisputeChatService } from './dispute-chat.service';

// POST /tournament/events/:eventId/matches/:matchId/chat — jugadores del match, árbitro del evento, o admin
// GET  /tournament/events/:eventId/matches/:matchId/chat — mismos participantes
@ApiTags('dispute-chat')
@ApiBearerAuth('access-token')
@ApiParam({ name: 'eventId', description: 'Event id' })
@ApiParam({ name: 'matchId', description: 'Match id' })
@Controller('tournament/events/:eventId/matches/:matchId/chat')
export class DisputeChatController {
  constructor(private readonly disputeChatService: DisputeChatService) {}

  @ApiOperation({
    summary: 'Send a chat message',
    description:
      "Participants: the match's two players, the event's referee, or admin. Stays open after the match closes. questionId is optional, for a dispute about one specific question.",
  })
  @Post()
  sendMessage(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateChatMessageDto,
  ) {
    return this.disputeChatService.sendMessage(eventId, matchId, user, dto);
  }

  @ApiOperation({
    summary: 'List chat messages — same participants as sendMessage',
  })
  @Get()
  listMessages(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.disputeChatService.listMessages(eventId, matchId, user);
  }
}
