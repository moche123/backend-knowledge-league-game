import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RankingService } from './ranking.service';

// GET /ranking                    — autenticado, leaderboard global
// GET /ranking/events/:eventId    — autenticado, leaderboard de un evento puntual
@ApiTags('ranking')
@ApiBearerAuth('access-token')
@Controller('ranking')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @ApiOperation({
    summary: 'Global leaderboard — sum of points across all events',
  })
  @Get()
  getGlobal() {
    return this.rankingService.getGlobalLeaderboard();
  }

  @ApiOperation({ summary: 'Leaderboard for one event' })
  @ApiParam({ name: 'eventId' })
  @Get('events/:eventId')
  getForEvent(@Param('eventId') eventId: string) {
    return this.rankingService.getEventLeaderboard(eventId);
  }
}
