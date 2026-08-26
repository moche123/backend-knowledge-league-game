import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class PublicUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: UserRole }) role!: UserRole;
  @ApiProperty() createdAt!: Date;
}

export class AuthResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ type: PublicUserDto }) user!: PublicUserDto;
}
