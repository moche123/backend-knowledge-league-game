import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum UserRole {
  PLAYER = 'player',
  ADMIN = 'admin',
  REFEREE = 'referee',
}

// The accumulated score doesn't live here — the ranking service computes/caches it (see CLAUDE.md).
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', unique: true })
  email!: string;

  @Column({ type: 'text', name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role' })
  role!: UserRole;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  // bcrypt hash of the current refresh token (rotated on every use) + its expiry.
  // Both null if the user never logged in or has logged out.
  @Column({ type: 'text', name: 'refresh_token_hash', nullable: true })
  refreshTokenHash!: string | null;

  @Column({
    type: 'timestamptz',
    name: 'refresh_token_expires_at',
    nullable: true,
  })
  refreshTokenExpiresAt!: Date | null;
}
