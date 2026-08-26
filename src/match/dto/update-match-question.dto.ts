import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

// Content correction only — questions can't be added to or removed from the
// batch (generated together, with scores that sum to exactly the budget).
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
