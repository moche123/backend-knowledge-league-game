import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registration } from './entities/registration.entity';
import {
  EventStatus,
  Tournament,
} from '../tournament/entities/tournament.entity';
import { User, UserRole } from '../auth/entities/user.entity';
import { Match, MatchStatus } from '../match/entities/match.entity';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class RegistrationService {
  constructor(
    @InjectRepository(Registration)
    private readonly registrationRepository: Repository<Registration>,
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
  ) {}

  registerSelf(eventId: string, userId: string): Promise<Registration> {
    return this.register(eventId, userId);
  }

  async registerByAdmin(
    eventId: string,
    userId: string,
  ): Promise<Registration> {
    const targetUser = await this.usersRepository.findOne({
      where: { id: userId },
    });
    if (!targetUser) {
      throw new NotFoundException(`User #${userId} not found`);
    }
    if (targetUser.role !== UserRole.PLAYER) {
      throw new BadRequestException(
        'Only players can be registered for an event',
      );
    }
    return this.register(eventId, userId);
  }

  async findAllForEvent(eventId: string): Promise<Registration[]> {
    await this.getEventOrThrow(eventId);
    return this.registrationRepository.find({ where: { eventId } });
  }

  async unregisterSelf(eventId: string, userId: string): Promise<void> {
    const event = await this.getEventOrThrow(eventId);
    if (event.status !== EventStatus.REGISTRATION_OPEN) {
      throw new ConflictException(
        'Cannot cancel registration once the event has started',
      );
    }
    await this.deleteOrThrow(eventId, userId);
  }

  // Removing a player who's currently slotted into a match: blocked outright
  // if that match is live (disqualify them from the match instead — see
  // MatchController.disqualifyPlayer); if it's only pending (not started),
  // they're cleared from that slot so the admin can pick a replacement via
  // MatchService.editParticipants. (2026-08-31, explicit user decision.)
  async unregisterByAdmin(eventId: string, userId: string): Promise<void> {
    const liveMatch = await this.matchRepository
      .createQueryBuilder('m')
      .innerJoin('stages', 's', 's.id = m.stage_id')
      .where('s.event_id = :eventId', { eventId })
      .andWhere('(m.player_a_id = :userId OR m.player_b_id = :userId)', {
        userId,
      })
      .andWhere('m.status = :status', { status: MatchStatus.IN_PROGRESS })
      .getExists();
    if (liveMatch) {
      throw new ConflictException(
        'This player is in a live match — disqualify them from the match instead of removing their registration.',
      );
    }

    const pendingMatches = await this.matchRepository
      .createQueryBuilder('m')
      .innerJoin('stages', 's', 's.id = m.stage_id')
      .where('s.event_id = :eventId', { eventId })
      .andWhere('(m.player_a_id = :userId OR m.player_b_id = :userId)', {
        userId,
      })
      .andWhere('m.status = :status', { status: MatchStatus.PENDING })
      .getMany();

    for (const match of pendingMatches) {
      if (match.playerAId === userId) match.playerAId = null;
      if (match.playerBId === userId) match.playerBId = null;
    }
    if (pendingMatches.length > 0) {
      await this.matchRepository.save(pendingMatches);
    }

    await this.deleteOrThrow(eventId, userId);
  }

  private async register(
    eventId: string,
    userId: string,
  ): Promise<Registration> {
    const event = await this.getEventOrThrow(eventId);
    if (event.status !== EventStatus.REGISTRATION_OPEN) {
      throw new ConflictException('Registration is closed for this event');
    }

    const registeredCount = await this.registrationRepository.count({
      where: { eventId },
    });
    if (registeredCount >= event.maxPlayers) {
      throw new ConflictException('Event has reached its player capacity');
    }

    const registration = this.registrationRepository.create({
      eventId,
      userId,
    });
    try {
      return await this.registrationRepository.save(registration);
    } catch (error) {
      if ((error as { code?: string }).code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException('Already registered for this event');
      }
      throw error;
    }
  }

  private async deleteOrThrow(eventId: string, userId: string): Promise<void> {
    const result = await this.registrationRepository.delete({
      eventId,
      userId,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Registration not found');
    }
  }

  private async getEventOrThrow(eventId: string): Promise<Tournament> {
    const event = await this.tournamentRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event #${eventId} not found`);
    }
    return event;
  }
}
