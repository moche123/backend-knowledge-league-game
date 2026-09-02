import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class PublicUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: UserRole }) role!: UserRole;
  @ApiProperty() createdAt!: Date;
}

// Deliberately narrow — just enough to show "vs {name}" or resolve an
// opponent/other participant's display name. No email/role/createdAt, so
// it's safe to open to ANY authenticated user (not admin-only like
// PublicUserDto's own endpoint) without leaking PII between players.
export class PublicNameDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class AuthResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ type: PublicUserDto }) user!: PublicUserDto;
}
