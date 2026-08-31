import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { UserRole } from '../entities/user.entity';

// Admin-only account creation. Role is deliberately restricted to
// player/referee — admin accounts stay a manual DB bootstrap (see CLAUDE.md),
// so this can never be used to mint another admin.
const CREATABLE_ROLES = [UserRole.PLAYER, UserRole.REFEREE] as const;
type CreatableRole = (typeof CREATABLE_ROLES)[number];

export class CreateUserByAdminDto {
  @ApiProperty({ example: 'Ada Lovelace' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'supersecret123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: CREATABLE_ROLES })
  @IsIn(CREATABLE_ROLES)
  role!: CreatableRole;
}
