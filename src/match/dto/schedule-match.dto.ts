import { IsDateString } from 'class-validator';

export class ScheduleMatchDto {
  @IsDateString()
  scheduledStartAt!: string;

  @IsDateString()
  scheduledEndAt!: string;
}
