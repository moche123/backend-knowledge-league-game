import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

// Dispute resolution — overturns who won a closed/walkover match, without
// touching scoreA/scoreB (those stay as the AI's assessment; this is a
// human judgment call on top of it, same spirit as overrideAnswerScore).
export class DeclareWinnerDto {
  @ApiProperty()
  @IsUUID()
  winnerId!: string;
}
