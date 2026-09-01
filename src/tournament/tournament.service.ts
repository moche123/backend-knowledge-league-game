import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { EventStatus, Tournament } from './entities/tournament.entity';

// Postgres error codes we care about here — see CHECK/UNIQUE in schema.sql.
const PG_CHECK_VIOLATION = '23514';
const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class TournamentService {
  constructor(
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
  ) {}

  async create(createTournamentDto: CreateTournamentDto): Promise<Tournament> {
    const tournament = this.tournamentRepository.create({
      ...createTournamentDto,
      startDate: new Date(createTournamentDto.startDate),
      endDate: new Date(createTournamentDto.endDate),
      status: EventStatus.REGISTRATION_OPEN,
    });
    return this.saveOrThrow(tournament);
  }

  findAll(): Promise<Tournament[]> {
    return this.tournamentRepository.find();
  }

  async findOne(id: string): Promise<Tournament> {
    const tournament = await this.tournamentRepository.findOne({
      where: { id },
    });
    if (!tournament) {
      throw new NotFoundException(`Tournament #${id} not found`);
    }
    return tournament;
  }

  async update(
    id: string,
    updateTournamentDto: UpdateTournamentDto,
  ): Promise<Tournament> {
    const tournament = await this.findOne(id);
    Object.assign(tournament, {
      ...updateTournamentDto,
      ...(updateTournamentDto.startDate && {
        startDate: new Date(updateTournamentDto.startDate),
      }),
      ...(updateTournamentDto.endDate && {
        endDate: new Date(updateTournamentDto.endDate),
      }),
    });
    return this.saveOrThrow(tournament);
  }

  async remove(id: string): Promise<void> {
    const result = await this.tournamentRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Tournament #${id} not found`);
    }
  }

  // Translates Postgres constraint violations (power-of-2, dates) into
  // readable HTTP errors instead of a raw 500.
  private async saveOrThrow(tournament: Tournament): Promise<Tournament> {
    try {
      return await this.tournamentRepository.save(tournament);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException('An event with this name already exists');
      }
      if (code === PG_CHECK_VIOLATION) {
        throw new BadRequestException('Tournament violates a data constraint');
      }
      throw error;
    }
  }
}
