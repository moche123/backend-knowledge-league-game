import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { StageType } from '../bracket';

// TypeORM needs the enum values at runtime (not just the TS type).
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

  // Draw seed for this stage — null until its pairings are drawn.
  @Column({ type: 'text', nullable: true })
  seed!: string | null;
}
