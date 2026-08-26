import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// ai_score / ai_justification los llena el evaluador IA (Fase 7, todavía no
// construido) — acá solo se persiste el texto y el timestamp de envío.
@Entity('answers')
export class Answer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'match_id' })
  matchId!: string;

  @Column({ type: 'uuid', name: 'question_id' })
  questionId!: string;

  @Column({ type: 'uuid', name: 'player_id' })
  playerId!: string;

  @Column({ type: 'text', name: 'answer_text' })
  answerText!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'submitted_at' })
  submittedAt!: Date;

  @Column({ type: 'numeric', name: 'ai_score', nullable: true })
  aiScore!: number | null;

  @Column({ type: 'text', name: 'ai_justification', nullable: true })
  aiJustification!: string | null;

  @Column({ type: 'numeric', name: 'admin_override_score', nullable: true })
  adminOverrideScore!: number | null;

  // Auditoría del override (Fase 10): quién corrigió, cuándo, por qué.
  @Column({ type: 'text', name: 'override_reason', nullable: true })
  overrideReason!: string | null;

  @Column({ type: 'uuid', name: 'overridden_by', nullable: true })
  overriddenBy!: string | null;

  @Column({ type: 'timestamptz', name: 'overridden_at', nullable: true })
  overriddenAt!: Date | null;
}
