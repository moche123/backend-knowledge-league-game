import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

// id, status y created_at los asigna el service (default 'registration_open'),
// no llegan del cliente. maxPlayers restringido al set de CLAUDE.md (4/8/16/32
// — MVP no soporta byes); el CHECK chk_players_power_of_2 en Postgres queda
// como backstop, no como única validación (acá da 400 en vez de 500).
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

  // Opcional: el admin puede asignarlo después (calendario del árbitro se
  // valida vía excl_referee_calendar en Postgres cuando sí viene seteado).
  @ApiPropertyOptional({
    description:
      'Can be assigned later. No two overlapping events may share a referee.',
  })
  @IsOptional()
  @IsUUID()
  refereeId?: string;
}
