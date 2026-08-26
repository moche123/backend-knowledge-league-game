import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum EventStatus {
  REGISTRATION_OPEN = 'registration_open',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
}

@Entity('events')
export class Tournament {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  name!: string;

  @Column({ type: 'text' })
  theme!: string;

  @Column({ type: 'timestamptz', name: 'start_date' })
  startDate!: Date;

  @Column({ type: 'timestamptz', name: 'end_date' })
  endDate!: Date;

  @Column({ type: 'int', name: 'max_players' })
  maxPlayers!: number;

  @Column({ type: 'int', name: 'questions_per_match' })
  questionsPerMatch!: number;

  @Column({ type: 'numeric', name: 'max_score_per_match', default: 100 })
  maxScorePerMatch!: number;

  @Column({ type: 'uuid', name: 'referee_id', nullable: true })
  refereeId!: string | null;

  @Column({
    type: 'enum',
    enum: EventStatus,
    enumName: 'event_status',
    default: EventStatus.REGISTRATION_OPEN,
  })
  status!: EventStatus;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
