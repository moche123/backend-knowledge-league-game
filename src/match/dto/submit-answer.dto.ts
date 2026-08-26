import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SubmitAnswerDto {
  @ApiProperty({ example: '1969' })
  @IsString()
  @MinLength(1)
  answerText!: string;
}
