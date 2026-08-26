import { Controller, Get, Param } from '@nestjs/common';
import { RankingService } from './ranking.service';

// GET /ranking                    — autenticado, leaderboard global
// GET /ranking/events/:eventId    — autenticado, leaderboard de un evento puntual
@Controller('ranking')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Get()
  getGlobal() {
    return this.rankingService.getGlobalLeaderboard();
  }

  @Get('events/:eventId')
  getForEvent(@Param('eventId') eventId: string) {
    return this.rankingService.getEventLeaderboard(eventId);
  }
}
