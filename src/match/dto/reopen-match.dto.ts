import { IsString, MinLength } from 'class-validator';

// Fase 10 — repetir un match cerrado desde cero (ej. plagio detectado
// post-match). El motivo queda logueado en el chat del match.
export class ReopenMatchDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}
