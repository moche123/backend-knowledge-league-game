import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { StageType } from '../bracket';

// TypeORM necesita los valores del enum en runtime (no solo el type de TS).
export const STAGE_TYPES: StageType[] = [
  'round_of_16',
  'quarterfinal',
  'semifinal',
  'final',
  'third_place',
];

@Entity('stages')
export class Stage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  @Column({ type: 'enum', enum: STAGE_TYPES, enumName: 'stage_type' })
  type!: StageType;

  @Column({ type: 'int' })
  position!: number;

  // Semilla del sorteo de esta fase — null hasta que se sortean sus cruces.
  @Column({ type: 'text', nullable: true })
  seed!: string | null;
}
