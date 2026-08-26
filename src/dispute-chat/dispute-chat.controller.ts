import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { DisputeChatService } from './dispute-chat.service';

// POST /tournament/events/:eventId/matches/:matchId/chat — jugadores del match, árbitro del evento, o admin
// GET  /tournament/events/:eventId/matches/:matchId/chat — mismos participantes
@Controller('tournament/events/:eventId/matches/:matchId/chat')
export class DisputeChatController {
  constructor(private readonly disputeChatService: DisputeChatService) {}

  @Post()
  sendMessage(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateChatMessageDto,
  ) {
    return this.disputeChatService.sendMessage(eventId, matchId, user, dto);
  }

  @Get()
  listMessages(
    @Param('eventId') eventId: string,
    @Param('matchId') matchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.disputeChatService.listMessages(eventId, matchId, user);
  }
}
