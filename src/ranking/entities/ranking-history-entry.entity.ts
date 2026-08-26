import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Historical ledger — the live global ranking is rebuilt by summing this per
// user (see CLAUDE.md). In the MVP monolith, no Redis: computed on the fly
// with an aggregate query instead of a sorted set.
@Entity('ranking_history')
export class RankingHistoryEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  // Which match generated this entry — allows correcting it if admin
  // overrides a score later (Fase 10).
  @Column({ type: 'uuid', name: 'match_id' })
  matchId!: string;

  @Column({ type: 'numeric', name: 'points_earned' })
  pointsEarned!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'earned_at' })
  earnedAt!: Date;
}
