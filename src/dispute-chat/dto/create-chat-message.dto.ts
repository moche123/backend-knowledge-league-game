import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateChatMessageDto {
  @ApiProperty({ example: 'I disagree with the score on this question' })
  @IsString()
  @MinLength(1)
  text!: string;

  // Optional — set when the dispute is about a specific question in the match.
  @ApiPropertyOptional({
    description:
      'Ties the message to one match_questions row, if the dispute is about a specific question',
  })
  @IsOptional()
  @IsUUID()
  questionId?: string;
}
