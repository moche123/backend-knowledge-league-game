import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

// At least one of the two must be provided — validated in the service.
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
