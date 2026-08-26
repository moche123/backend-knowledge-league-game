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
import { Tournament } from '../tournament/entities/tournament.entity';
import { UserRole } from '../auth/entities/user.entity';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

// Chat de reclamos dentro del match — jugadores del match, árbitro asignado
// al evento, y admin como participantes (ver CLAUDE.md). El admin puede
// resolver disputas a partir de lo discutido acá; overridear el puntaje de
// la IA queda para Fase 10 (fuera de este alcance).
@Injectable()
export class DisputeChatService {
  constructor(
    @InjectRepository(DisputeChatMessage)
    private readonly messageRepository: Repository<DisputeChatMessage>,
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    @InjectRepository(Stage)
    private readonly stageRepository: Repository<Stage>,
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
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
      const event = await this.tournamentRepository.findOne({
        where: { id: eventId },
      });
      if (!event || event.refereeId !== requester.id) {
        throw new ForbiddenException('Not the referee assigned to this event');
      }
      return match;
    }
    throw new ForbiddenException('Not a participant of this match');
  }
}
