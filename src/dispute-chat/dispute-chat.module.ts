import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisputeChatMessage } from './entities/dispute-chat-message.entity';
import { Match } from '../match/entities/match.entity';
import { MatchQuestion } from '../match/entities/match-question.entity';
import { Stage } from '../stage/entities/stage.entity';
import { Tournament } from '../tournament/entities/tournament.entity';
import { DisputeChatController } from './dispute-chat.controller';
import { DisputeChatService } from './dispute-chat.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DisputeChatMessage,
      Match,
      MatchQuestion,
      Stage,
      Tournament,
    ]),
  ],
  controllers: [DisputeChatController],
  providers: [DisputeChatService],
})
export class DisputeChatModule {}
