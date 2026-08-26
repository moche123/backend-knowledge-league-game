import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

// Al menos uno de los dos debe venir — se valida en el service.
export class EditParticipantsDto {
  @ApiPropertyOptional({
    description:
      'Must be registered in the event, not already playing another match of the same stage',
  })
  @IsOptional()
  @IsUUID()
  playerAId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  playerBId?: string;
}
