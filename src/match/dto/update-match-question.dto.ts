import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

// Solo corrección de contenido — no se agrega ni se saca una pregunta del
// lote (se generó junto, con puntajes que suman exacto el presupuesto).
export class UpdateMatchQuestionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  text?: string;

  @ApiPropertyOptional({
    example: 'Expected answer: 1969, also accept "year 69"',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  rubric?: string;

  @ApiPropertyOptional({ minimum: 0.01 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  maxScore?: number;

  @ApiPropertyOptional({ description: 'Seconds', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimit?: number;
}
