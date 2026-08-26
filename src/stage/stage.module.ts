import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stage } from './entities/stage.entity';
import { Match } from '../match/entities/match.entity';
import { Tournament } from '../tournament/entities/tournament.entity';
import { Registration } from '../registration/entities/registration.entity';
import { StageController } from './stage.controller';
import { StageService } from './stage.service';

@Module({
  imports: [TypeOrmModule.forFeature([Stage, Match, Tournament, Registration])],
  controllers: [StageController],
  providers: [StageService],
  exports: [StageService],
})
export class StageModule {}
