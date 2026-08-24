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

// El puntaje acumulado no vive acá — lo calcula/cachea ranking-service (ver CLAUDE.md).
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

  // Hash bcrypt del refresh token vigente (rotación en cada uso) + su expiración.
  // Nulos si el usuario nunca hizo login o cerró sesión.
  @Column({ type: 'text', name: 'refresh_token_hash', nullable: true })
  refreshTokenHash!: string | null;

  @Column({
    type: 'timestamptz',
    name: 'refresh_token_expires_at',
    nullable: true,
  })
  refreshTokenExpiresAt!: Date | null;
}
