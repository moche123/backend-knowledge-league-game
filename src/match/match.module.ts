import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Answer } from './entities/answer.entity';
import { MatchQuestion } from './entities/match-question.entity';
import { Match } from './entities/match.entity';
import { Stage } from '../stage/entities/stage.entity';
import { StageModule } from '../stage/stage.module';
import { Registration } from '../registration/entities/registration.entity';
import { Tournament } from '../tournament/entities/tournament.entity';
import { RankingModule } from '../ranking/ranking.module';
import { DisputeChatMessage } from '../dispute-chat/entities/dispute-chat-message.entity';
import { MatchController } from './match.controller';
import { MatchQuestionGenerationService } from './match-question-generation.service';
import { MatchScoringService } from './match-scoring.service';
import { MatchService } from './match.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Match,
      Stage,
      Registration,
      Tournament,
      MatchQuestion,
      Answer,
      DisputeChatMessage,
    ]),
    StageModule,
    RankingModule,
  ],
  controllers: [MatchController],
  providers: [
    MatchService,
    MatchQuestionGenerationService,
    MatchScoringService,
  ],
})
export class MatchModule {}
