import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

// id, status and created_at are assigned by the service (default 'registration_open'),
// they don't come from the client. maxPlayers restricted to the CLAUDE.md set (4/8/16/32
// — MVP doesn't support byes); the chk_players_power_of_2 CHECK in Postgres stays
// as a backstop, not the only validation (this gives a 400 instead of a 500).
export class CreateTournamentDto {
  @ApiProperty({ example: 'Copa Saber', description: 'Unique, case-sensitive' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'history' })
  @IsString()
  @MinLength(1)
  theme!: string;

  @ApiProperty({ example: '2026-09-01T00:00:00Z' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-09-15T00:00:00Z' })
  @IsDateString()
  endDate!: string;

  @ApiProperty({
    enum: [4, 8, 16, 32],
    example: 8,
    description: 'No byes in the MVP',
  })
  @IsInt()
  @IsIn([4, 8, 16, 32])
  maxPlayers!: number;

  @ApiProperty({ example: 5, minimum: 1 })
  @IsInt()
  @Min(1)
  questionsPerMatch!: number;

  @ApiPropertyOptional({ example: 100, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxScorePerMatch?: number;
}
