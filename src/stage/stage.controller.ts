import { Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { StageService } from './stage.service';

// POST /tournament/events/:eventId/stages/draw — admin, cierra inscripción
//   y sortea la primera fase (crea el árbol completo de fases del evento).
// GET  /tournament/events/:eventId/stages       — autenticado, ver el bracket.
@Controller('tournament/events/:eventId/stages')
export class StageController {
  constructor(private readonly stageService: StageService) {}

  @Roles(UserRole.ADMIN)
  @Post('draw')
  drawFirstStage(@Param('eventId') eventId: string) {
    return this.stageService.drawFirstStage(eventId);
  }

  @Get()
  findAll(@Param('eventId') eventId: string) {
    return this.stageService.findAllForEvent(eventId);
  }
}
