import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  buildStageSequence,
  drawPairs,
  generateSeed,
  StageType,
} from './bracket';
import { Stage } from './entities/stage.entity';
import { Match, MatchStatus } from '../match/entities/match.entity';
import {
  EventStatus,
  Tournament,
} from '../tournament/entities/tournament.entity';
import { Registration } from '../registration/entities/registration.entity';

export interface StageWithMatches extends Stage {
  matches: Match[];
}

// Which stage comes next after this one closes, and where its participants come from.
// third_place is the special case: it comes from semifinal's LOSERS, not its
// winners — that's why semifinal triggers two stages at once.
const NEXT_STAGE_FROM_WINNERS: Partial<Record<StageType, StageType>> = {
  round_of_16: 'quarterfinal',
  quarterfinal: 'semifinal',
};

@Injectable()
export class StageService {
  constructor(
    @InjectRepository(Stage)
    private readonly stageRepository: Repository<Stage>,
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
    @InjectRepository(Registration)
    private readonly registrationRepository: Repository<Registration>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // Closes registration and draws the first stage: creates the event's full
  // stage tree and the first stage's matches, with a recorded, auditable seed.
  async drawFirstStage(eventId: string): Promise<StageWithMatches[]> {
    const event = await this.tournamentRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event #${eventId} not found`);
    }
    if (event.status !== EventStatus.REGISTRATION_OPEN) {
      throw new ConflictException('Event is not open for registration');
    }

    const registrations = await this.registrationRepository.find({
      where: { eventId },
    });
    if (registrations.length !== event.maxPlayers) {
      throw new ConflictException(
        `Need exactly ${event.maxPlayers} registered players to draw the bracket (currently ${registrations.length})`,
      );
    }

    let stageTypes: ReturnType<typeof buildStageSequence>;
    try {
      stageTypes = buildStageSequence(event.maxPlayers);
    } catch (error) {
      throw new ConflictException((error as Error).message);
    }

    const seed = generateSeed();
    const pairs = drawPairs(
      registrations.map((registration) => registration.userId),
      seed,
    );

    return this.dataSource.transaction(async (manager) => {
      const stages = stageTypes.map((type, index) =>
        manager.create(Stage, {
          eventId,
          type,
          position: index + 1,
          seed: index === 0 ? seed : null,
        }),
      );
      const savedStages = await manager.save(Stage, stages);
      const firstStage = savedStages[0];

      const matches = pairs.map(([playerAId, playerBId]) =>
        manager.create(Match, {
          stageId: firstStage.id,
          playerAId,
          playerBId,
          status: MatchStatus.PENDING,
        }),
      );
      const savedMatches = await manager.save(Match, matches);

      await manager.update(Tournament, eventId, {
        status: EventStatus.IN_PROGRESS,
      });

      return savedStages.map((stage) => ({
        ...stage,
        matches: stage.id === firstStage.id ? savedMatches : [],
      }));
    });
  }

  // Called by MatchService whenever a match closes (closed/walkover). If that
  // was the stage's last pending match, draws the next stage(s) with the real
  // winners (and losers, for third_place). Idempotent: if the next stage
  // already has a seed, it won't draw again.
  async checkAndAdvance(stageId: string): Promise<void> {
    const stage = await this.stageRepository.findOne({
      where: { id: stageId },
    });
    if (!stage) return;

    const matches = await this.matchRepository.find({ where: { stageId } });
    const allTerminal =
      matches.length > 0 &&
      matches.every(
        (match) =>
          match.status === MatchStatus.CLOSED ||
          match.status === MatchStatus.WALKOVER,
      );
    if (!allTerminal) return;

    await this.dataSource.transaction(async (manager) => {
      if (stage.type === 'final' || stage.type === 'third_place') {
        await this.maybeFinishEvent(manager, stage.eventId);
        return;
      }

      const winners = matches
        .map((match) => match.winnerId)
        .filter((id): id is string => !!id);

      if (stage.type === 'semifinal') {
        const losers = matches
          .map((match) =>
            match.winnerId === match.playerAId
              ? match.playerBId
              : match.playerAId,
          )
          .filter((id): id is string => !!id);
        const finalStage = await manager.findOne(Stage, {
          where: { eventId: stage.eventId, type: 'final' },
        });
        const thirdPlaceStage = await manager.findOne(Stage, {
          where: { eventId: stage.eventId, type: 'third_place' },
        });
        if (finalStage)
          await this.drawStageMatches(manager, finalStage, winners);
        if (thirdPlaceStage)
          await this.drawStageMatches(manager, thirdPlaceStage, losers);
        return;
      }

      const nextType = NEXT_STAGE_FROM_WINNERS[stage.type];
      if (!nextType) return;
      const nextStage = await manager.findOne(Stage, {
        where: { eventId: stage.eventId, type: nextType },
      });
      if (nextStage) await this.drawStageMatches(manager, nextStage, winners);
    });
  }

  async findAllForEvent(eventId: string): Promise<StageWithMatches[]> {
    const event = await this.tournamentRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event #${eventId} not found`);
    }

    const stages = await this.stageRepository.find({
      where: { eventId },
      order: { position: 'ASC' },
    });
    const stageIds = stages.map((stage) => stage.id);
    const matches = stageIds.length
      ? await this.matchRepository
          .createQueryBuilder('match')
          .where('match.stage_id IN (:...stageIds)', { stageIds })
          .getMany()
      : [];

    return stages.map((stage) => ({
      ...stage,
      matches: matches.filter((match) => match.stageId === stage.id),
    }));
  }

  private async drawStageMatches(
    manager: EntityManager,
    stage: Stage,
    participantIds: string[],
  ): Promise<void> {
    if (stage.seed) return; // already drawn — idempotency

    const seed = generateSeed();
    const pairs = drawPairs(participantIds, seed);

    const matches = pairs.map(([playerAId, playerBId]) =>
      manager.create(Match, {
        stageId: stage.id,
        playerAId,
        playerBId,
        status: MatchStatus.PENDING,
      }),
    );
    await manager.save(Match, matches);
    await manager.update(Stage, stage.id, { seed });
  }

  private async maybeFinishEvent(
    manager: EntityManager,
    eventId: string,
  ): Promise<void> {
    const closingStages = await manager.find(Stage, {
      where: { eventId, type: In(['final', 'third_place']) },
    });
    if (closingStages.length !== 2) return;

    const stageIds = closingStages.map((stage) => stage.id);
    const matches = await manager.find(Match, {
      where: { stageId: In(stageIds) },
    });
    const allDone =
      matches.length === 2 &&
      matches.every(
        (match) =>
          match.status === MatchStatus.CLOSED ||
          match.status === MatchStatus.WALKOVER,
      );
    if (allDone) {
      await manager.update(Tournament, eventId, {
        status: EventStatus.FINISHED,
      });
    }
  }
}
