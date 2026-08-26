import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RankingService } from './ranking.service';

// GET /ranking                    — authenticated, global leaderboard
// GET /ranking/events/:eventId    — authenticated, leaderboard for one specific event
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
