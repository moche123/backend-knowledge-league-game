import { IsNumber, IsString, Min, MinLength } from 'class-validator';

// Fase 10 — admin corrige el puntaje de la IA a partir de lo discutido en
// el chat de reclamos. reason queda logueado (auditoría).
export class OverrideAnswerScoreDto {
  @IsNumber()
  @Min(0)
  score!: number;

  @IsString()
  @MinLength(1)
  reason!: string;
}
