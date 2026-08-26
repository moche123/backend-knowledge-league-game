import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Single source of truth for a match's questions — no shared per-event bank,
// each match generates its own when scheduled (see MatchQuestionGenerationService,
// triggered from MatchService.schedule()).
@Entity('match_questions')
export class MatchQuestion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'match_id' })
  matchId!: string;

  @Column({ type: 'int' })
  position!: number;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'text' })
  rubric!: string;

  @Column({ type: 'numeric', name: 'max_score' })
  maxScore!: number;

  // Seconds.
  @Column({ type: 'int', name: 'time_limit' })
  timeLimit!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  // When this became the match's active question — the basis for the speed
  // calculation (30% of the scoring formula).
  @Column({ type: 'timestamptz', name: 'activated_at', nullable: true })
  activatedAt!: Date | null;
}
