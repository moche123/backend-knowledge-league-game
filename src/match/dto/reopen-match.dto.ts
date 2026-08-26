import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

// Fase 10 — repetir un match cerrado desde cero (ej. plagio detectado
// post-match). El motivo queda logueado en el chat del match.
export class ReopenMatchDto {
  @ApiProperty({
    example:
      'Plagiarism detected in player A answer, reopening to substitute them',
  })
  @IsString()
  @MinLength(1)
  reason!: string;
}
