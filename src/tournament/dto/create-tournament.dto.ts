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
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  theme!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsInt()
  @IsIn([4, 8, 16, 32])
  maxPlayers!: number;

  @IsInt()
  @Min(1)
  questionsPerMatch!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxScorePerMatch?: number;

  // Opcional: el admin puede asignarlo después (calendario del árbitro se
  // valida vía excl_referee_calendar en Postgres cuando sí viene seteado).
  @IsOptional()
  @IsUUID()
  refereeId?: string;
}
