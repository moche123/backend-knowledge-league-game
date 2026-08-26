import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Ledger histórico — el ranking global vivo se reconstruye sumando esto por
// usuario (ver CLAUDE.md). En el MVP monolito, sin Redis: se calcula al
// vuelo con una query agregada en vez de un sorted set.
@Entity('ranking_history')
export class RankingHistoryEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  // Qué match generó esta entrada — permite corregirla si el admin
  // overridea un puntaje después (Fase 10).
  @Column({ type: 'uuid', name: 'match_id' })
  matchId!: string;

  @Column({ type: 'numeric', name: 'points_earned' })
  pointsEarned!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'earned_at' })
  earnedAt!: Date;
}
