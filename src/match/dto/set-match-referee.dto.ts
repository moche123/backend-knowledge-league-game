import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SetMatchRefereeDto {
  @ApiProperty()
  @IsUUID()
  refereeId!: string;
}
