import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RankingHistoryEntry } from './entities/ranking-history-entry.entity';
import { Match } from '../match/entities/match.entity';
import { Tournament } from '../tournament/entities/tournament.entity';

export interface LeaderboardRow {
  userId: string;
  name: string;
  totalPoints: number;
  matchesPlayed: number;
  eventsPlayed: number;
  winRate: number; // 0-100, rounded — share of ledger matches this user won
}

@Injectable()
export class RankingService {
  constructor(
    @InjectRepository(RankingHistoryEntry)
    private readonly rankingRepository: Repository<RankingHistoryEntry>,
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
  ) {}

  // Called when a match closes (closed or walkover), and again whenever an
  // admin override changes its result (Fase 10) — that's why it deletes any
  // old entries for THIS match first before inserting, so it stays correct
  // without duplicating or leaving stale points floating around.
  async recordMatchResult(match: Match, eventId: string): Promise<void> {
    await this.rankingRepository.delete({ matchId: match.id });

    const entries: RankingHistoryEntry[] = [];
    if (match.playerAId && match.scoreA !== null) {
      entries.push(
        this.rankingRepository.create({
          userId: match.playerAId,
          eventId,
          matchId: match.id,
          pointsEarned: match.scoreA,
        }),
      );
    }
    if (match.playerBId && match.scoreB !== null) {
      entries.push(
        this.rankingRepository.create({
          userId: match.playerBId,
          eventId,
          matchId: match.id,
          pointsEarned: match.scoreB,
        }),
      );
    }
    if (entries.length > 0) {
      await this.rankingRepository.save(entries);
    }
  }

  // Clears the ledger for a reopened match (Fase 10) — it's played again
  // from scratch, the old result shouldn't keep counting.
  async clearMatchResult(matchId: string): Promise<void> {
    await this.rankingRepository.delete({ matchId });
  }

  // Live global ranking — rebuilt by summing the ledger (no Redis in the
  // MVP monolith, see CLAUDE.md).
  async getGlobalLeaderboard(): Promise<LeaderboardRow[]> {
    return this.queryLeaderboard();
  }

  async getEventLeaderboard(eventId: string): Promise<LeaderboardRow[]> {
    const event = await this.tournamentRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event #${eventId} not found`);
    }
    return this.queryLeaderboard(eventId);
  }

  private async queryLeaderboard(eventId?: string): Promise<LeaderboardRow[]> {
    const query = this.rankingRepository
      .createQueryBuilder('rh')
      .innerJoin('users', 'u', 'u.id = rh.user_id')
      .innerJoin('matches', 'm', 'm.id = rh.match_id')
      .select('rh.user_id', 'userId')
      .addSelect('u.name', 'name')
      .addSelect('SUM(rh.points_earned)', 'totalPoints')
      .addSelect('COUNT(DISTINCT rh.event_id)', 'eventsPlayed')
      .addSelect('COUNT(rh.match_id)', 'matchesPlayed')
      .addSelect('COUNT(CASE WHEN m.winner_id = rh.user_id THEN 1 END)', 'wins')
      .groupBy('rh.user_id')
      .addGroupBy('u.name')
      .orderBy('"totalPoints"', 'DESC');

    if (eventId) {
      query.where('rh.event_id = :eventId', { eventId });
    }

    const rows = await query.getRawMany<{
      userId: string;
      name: string;
      totalPoints: string;
      eventsPlayed: string;
      matchesPlayed: string;
      wins: string;
    }>();
    return rows.map((row) => {
      const matchesPlayed = Number(row.matchesPlayed);
      const wins = Number(row.wins);
      return {
        userId: row.userId,
        name: row.name,
        totalPoints: Number(row.totalPoints),
        eventsPlayed: Number(row.eventsPlayed),
        matchesPlayed,
        winRate:
          matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0,
      };
    });
  }
}
