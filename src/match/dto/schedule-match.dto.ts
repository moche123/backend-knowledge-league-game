import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, Min } from 'class-validator';

export class ScheduleMatchDto {
  @ApiProperty({ example: '2026-09-01T15:00:00Z' })
  @IsDateString()
  scheduledStartAt!: string;

  @ApiProperty({ example: 30, description: 'Match duration in minutes' })
  @IsInt()
  @Min(1)
  durationMinutes!: number;
}
