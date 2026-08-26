import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class ScheduleMatchDto {
  @ApiProperty({ example: '2026-09-01T15:00:00Z' })
  @IsDateString()
  scheduledStartAt!: string;

  @ApiProperty({ example: '2026-09-01T15:30:00Z' })
  @IsDateString()
  scheduledEndAt!: string;
}
