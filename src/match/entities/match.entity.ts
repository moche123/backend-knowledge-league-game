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
  // Nadie lo inició antes de scheduledEndAt — sin puntajes, requiere reagendar.
  EXPIRED = 'expired',
}

// El flujo de responder preguntas / puntaje / walkover-por-ausencia-total se
// agrega aparte (ver CLAUDE.md, Fase 6 del roadmap).
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

  // Programación manual del admin — null hasta que la fija.
  @Column({ type: 'timestamptz', name: 'scheduled_start_at', nullable: true })
  scheduledStartAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'scheduled_end_at', nullable: true })
  scheduledEndAt!: Date | null;

  // Hora real en que admin/árbitro arrancó/cerró el match — puede diferir de
  // lo programado (arranca tarde, termina antes de lo estimado).
  @Column({ type: 'timestamptz', name: 'started_at', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'ended_at', nullable: true })
  endedAt!: Date | null;

  // Puntero a la pregunta activa (posición en match_questions) + su deadline
  // — timers de pregunta sin Redis, ver CLAUDE.md.
  @Column({ type: 'int', name: 'current_question_position', nullable: true })
  currentQuestionPosition!: number | null;

  @Column({
    type: 'timestamptz',
    name: 'current_question_deadline',
    nullable: true,
  })
  currentQuestionDeadline!: Date | null;
}
