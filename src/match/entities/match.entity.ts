import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum MatchStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  CLOSED = 'closed',
  WALKOVER = 'walkover',
  // Nobody started it before scheduledEndAt — no scores, needs rescheduling.
  EXPIRED = 'expired',
}

// The answer-questions / scoring / walkover-by-total-absence flow is added
// separately (see CLAUDE.md, roadmap Fase 6).
@Entity('matches')
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'stage_id' })
  stageId!: string;

  @Column({ type: 'uuid', name: 'player_a_id', nullable: true })
  playerAId!: string | null;

  @Column({ type: 'uuid', name: 'player_b_id', nullable: true })
  playerBId!: string | null;

  @Column({
    type: 'enum',
    enum: MatchStatus,
    enumName: 'match_status',
    default: MatchStatus.PENDING,
  })
  status!: MatchStatus;

  @Column({ type: 'uuid', name: 'winner_id', nullable: true })
  winnerId!: string | null;

  @Column({ type: 'numeric', name: 'score_a', nullable: true })
  scoreA!: number | null;

  @Column({ type: 'numeric', name: 'score_b', nullable: true })
  scoreB!: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  // Admin's manual scheduling — null until they set it.
  @Column({ type: 'timestamptz', name: 'scheduled_start_at', nullable: true })
  scheduledStartAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'scheduled_end_at', nullable: true })
  scheduledEndAt!: Date | null;

  // Actual time admin/referee started/closed the match — can differ from what
  // was scheduled (starts late, ends earlier than estimated).
  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'ended_at', nullable: true })
  endedAt!: Date | null;

  // Pointer to the active question (position in match_questions) + its deadline
  // — question timers without Redis, see CLAUDE.md.
  @Column({ type: 'int', name: 'current_question_position', nullable: true })
  currentQuestionPosition!: number | null;

  @Column({
    type: 'timestamptz',
    name: 'current_question_deadline',
    nullable: true,
  })
  currentQuestionDeadline!: Date | null;
}
