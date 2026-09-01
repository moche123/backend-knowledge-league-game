import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Registration } from './entities/registration.entity';
import { Tournament } from '../tournament/entities/tournament.entity';
import { User } from '../auth/entities/user.entity';
import { Match } from '../match/entities/match.entity';
import { Stage } from '../stage/entities/stage.entity';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Registration, Tournament, User, Match, Stage]),
  ],
  controllers: [RegistrationController],
  providers: [RegistrationService],
})
export class RegistrationModule {}
