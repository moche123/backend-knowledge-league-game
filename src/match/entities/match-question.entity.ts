import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Única fuente de verdad de las preguntas de un match — sin banco compartido
// por evento, cada match genera las suyas al agendarse (ver
// MatchQuestionGenerationService, disparado desde MatchService.schedule()).
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

  // Segundos.
  @Column({ type: 'int', name: 'time_limit' })
  timeLimit!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  // Cuándo pasó a ser la pregunta activa del match — base del cálculo de
  // velocidad (30% de la fórmula de scoring).
  @Column({ type: 'timestamptz', name: 'activated_at', nullable: true })
  activatedAt!: Date | null;
}
