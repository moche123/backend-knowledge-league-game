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
  @IsOptional()
  @IsString()
  @MinLength(1)
  text?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  rubric?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  maxScore?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  timeLimit?: number;
}
