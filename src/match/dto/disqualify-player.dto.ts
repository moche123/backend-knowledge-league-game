import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class DisqualifyPlayerDto {
  @ApiProperty()
  @IsUUID()
  playerId!: string;
}
