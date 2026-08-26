import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/auth/entities/user.entity';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { Tournament } from './entities/tournament.entity';
import { TournamentService } from './tournament.service';

// POST /events — admin
// GET /events — autenticado (Fase 4, vista jugador, reutiliza esta misma ruta sin restricción de rol admin)
// GET /events/:id — autenticado
// PATCH /events/:id — admin
// DELETE /events/:id — admin

@ApiTags('tournament')
@ApiBearerAuth('access-token')
@Controller('tournament')
export class TournamentController {
  constructor(private readonly tournamentService: TournamentService) {}

  @ApiOperation({ summary: 'Create an event (admin)' })
  @ApiOkResponse({ type: Tournament })
  @Roles(UserRole.ADMIN)
  @Post('events')
  create(@Body() createTournamentDto: CreateTournamentDto) {
    return this.tournamentService.create(createTournamentDto);
  }

  @ApiOperation({ summary: 'List all events' })
  @ApiOkResponse({ type: Tournament, isArray: true })
  @Get('events')
  findAll() {
    return this.tournamentService.findAll();
  }

  @ApiOperation({ summary: 'Get one event by id' })
  @ApiOkResponse({ type: Tournament })
  @Get('events/:id')
  findOne(@Param('id') id: string) {
    return this.tournamentService.findOne(id);
  }

  @ApiOperation({ summary: 'Partially update an event (admin)' })
  @ApiOkResponse({ type: Tournament })
  @Roles(UserRole.ADMIN)
  @Patch('events/:id')
  update(
    @Param('id') id: string,
    @Body() updateTournamentDto: UpdateTournamentDto,
  ) {
    return this.tournamentService.update(id, updateTournamentDto);
  }

  @ApiOperation({ summary: 'Delete an event (admin)' })
  @ApiNoContentResponse()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('events/:id')
  remove(@Param('id') id: string) {
    return this.tournamentService.remove(id);
  }
}
