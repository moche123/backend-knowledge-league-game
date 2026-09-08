import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisputeChatMessage } from './entities/dispute-chat-message.entity';
import { Match } from '../match/entities/match.entity';
import { MatchQuestion } from '../match/entities/match-question.entity';
import { Stage } from '../stage/entities/stage.entity';
import { DisputeChatController } from './dispute-chat.controller';
import { DisputeChatService } from './dispute-chat.service';
import { DisputeChatGateway } from './dispute-chat.gateway';
import { RealtimeModule } from '../realtime/realtime.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    RealtimeModule,
    AuthModule,
    TypeOrmModule.forFeature([DisputeChatMessage, Match, MatchQuestion, Stage]),
  ],
  controllers: [DisputeChatController],
  providers: [DisputeChatService, DisputeChatGateway],
})
export class DisputeChatModule {}
