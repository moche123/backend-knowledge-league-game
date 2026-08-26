import { IsOptional, IsUUID } from 'class-validator';

// Al menos uno de los dos debe venir — se valida en el service.
export class EditParticipantsDto {
  @IsOptional()
  @IsUUID()
  playerAId?: string;

  @IsOptional()
  @IsUUID()
  playerBId?: string;
}
