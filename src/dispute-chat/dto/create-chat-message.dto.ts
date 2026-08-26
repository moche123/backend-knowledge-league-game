import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateChatMessageDto {
  @IsString()
  @MinLength(1)
  text!: string;

  // Opcional — si el reclamo es sobre una pregunta puntual del match.
  @IsOptional()
  @IsUUID()
  questionId?: string;
}
