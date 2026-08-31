import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { DisputeChatMessage } from './entities/dispute-chat-message.entity';
import { Match } from '../match/entities/match.entity';
import { MatchQuestion } from '../match/entities/match-question.entity';
import { Stage } from '../stage/entities/stage.entity';
import { UserRole } from '../auth/entities/user.entity';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

// In-match dispute chat — the match's players, its assigned referee (auto-
// picked when the match was scheduled, or overridden by admin — see
// MatchService.schedule/setReferee), and admin as participants (see
// CLAUDE.md). Admin can resolve disputes based on what's discussed here;
// overriding the AI score is Fase 10 (out of scope here).
@Injectable()
export class DisputeChatService {
  constructor(
    @InjectRepository(DisputeChatMessage)
    private readonly messageRepository: Repository<DisputeChatMessage>,
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    @InjectRepository(Stage)
    private readonly stageRepository: Repository<Stage>,
    @InjectRepository(MatchQuestion)
    private readonly matchQuestionRepository: Repository<MatchQuestion>,
  ) {}

  async sendMessage(
    eventId: string,
    matchId: string,
    requester: AuthenticatedUser,
    dto: CreateChatMessageDto,
  ): Promise<DisputeChatMessage> {
    await this.getMatchOrThrow(eventId, matchId, requester);

    if (dto.questionId) {
      const belongsToMatch = await this.matchQuestionRepository.exists({
        where: { id: dto.questionId, matchId },
      });
      if (!belongsToMatch) {
        throw new BadRequestException(
          `Question #${dto.questionId} does not belong to this match`,
        );
      }
    }

    const message = this.messageRepository.create({
      matchId,
      questionId: dto.questionId ?? null,
      authorId: requester.id,
      text: dto.text,
    });
    return this.messageRepository.save(message);
  }

  async listMessages(
    eventId: string,
    matchId: string,
    requester: AuthenticatedUser,
  ): Promise<DisputeChatMessage[]> {
    await this.getMatchOrThrow(eventId, matchId, requester);
    return this.messageRepository.find({
      where: { matchId },
      order: { createdAt: 'ASC' },
    });
  }

  private async getMatchOrThrow(
    eventId: string,
    matchId: string,
    requester: AuthenticatedUser,
  ): Promise<Match> {
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
    });
    if (!match) {
      throw new NotFoundException(`Match #${matchId} not found`);
    }
    const stage = await this.stageRepository.findOne({
      where: { id: match.stageId },
    });
    if (!stage || stage.eventId !== eventId) {
      throw new NotFoundException(`Match #${matchId} not found`);
    }

    if (requester.role === UserRole.ADMIN) {
      return match;
    }
    if (requester.role === UserRole.PLAYER) {
      if (
        requester.id !== match.playerAId &&
        requester.id !== match.playerBId
      ) {
        throw new ForbiddenException('Not a participant of this match');
      }
      return match;
    }
    if (requester.role === UserRole.REFEREE) {
      if (match.refereeId !== requester.id) {
        throw new ForbiddenException('Not the referee assigned to this match');
      }
      return match;
    }
    throw new ForbiddenException('Not a participant of this match');
  }
}
