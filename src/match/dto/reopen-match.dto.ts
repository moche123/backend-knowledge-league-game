import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

// Fase 10 — repeats a closed match from scratch (e.g. plagiarism detected
// post-match). The reason gets logged in the match's chat.
export class ReopenMatchDto {
  @ApiProperty({
    example:
      'Plagiarism detected in player A answer, reopening to substitute them',
  })
  @IsString()
  @MinLength(1)
  reason!: string;
}
