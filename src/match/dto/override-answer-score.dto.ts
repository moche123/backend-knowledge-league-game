import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min, MinLength } from 'class-validator';

// Fase 10 — admin corrects the AI score based on what was discussed in the
// dispute chat. reason gets logged (audit trail).
export class OverrideAnswerScoreDto {
  @ApiProperty({ example: 15, minimum: 0 })
  @IsNumber()
  @Min(0)
  score!: number;

  @ApiProperty({
    example:
      'Answer covered the key point the AI missed, per the dispute chat discussion',
  })
  @IsString()
  @MinLength(1)
  reason!: string;
}
