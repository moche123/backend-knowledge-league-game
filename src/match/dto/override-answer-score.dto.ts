import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Min, MinLength } from 'class-validator';

// Fase 10 — admin corrige el puntaje de la IA a partir de lo discutido en
// el chat de reclamos. reason queda logueado (auditoría).
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
