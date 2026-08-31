import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsString, Min, MinLength } from 'class-validator';

// Manual addition to a match's question set (admin) — see CLAUDE.md: matches
// can now have questions added/removed while still pending, as long as the
// set's total maxScore never exceeds the event's maxScorePerMatch budget.
export class CreateMatchQuestionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  text!: string;

  @ApiProperty({ example: 'Expected answer: 1969, also accept "year 69"' })
  @IsString()
  @MinLength(1)
  rubric!: string;

  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  maxScore!: number;

  @ApiProperty({ description: 'Seconds', minimum: 1 })
  @IsInt()
  @Min(1)
  timeLimit!: number;
}
