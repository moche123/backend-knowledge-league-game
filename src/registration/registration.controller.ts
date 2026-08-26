import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { RegistrationService } from './registration.service';

// POST   /tournament/events/:eventId/registrations         — jugador se inscribe a sí mismo
// GET    /tournament/events/:eventId/registrations         — autenticado, lista inscriptos
// DELETE /tournament/events/:eventId/registrations/me      — jugador cancela su inscripción (solo si sigue abierta)
// POST   /tournament/events/:eventId/registrations/:userId — admin inscribe a un jugador puntual
// DELETE /tournament/events/:eventId/registrations/:userId — admin desinscribe a un jugador puntual
@Controller('tournament/events/:eventId/registrations')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Roles(UserRole.PLAYER)
  @Post()
  registerSelf(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrationService.registerSelf(eventId, user.id);
  }

  @Get()
  findAll(@Param('eventId') eventId: string) {
    return this.registrationService.findAllForEvent(eventId);
  }

  @Roles(UserRole.PLAYER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('me')
  unregisterSelf(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrationService.unregisterSelf(eventId, user.id);
  }

  @Roles(UserRole.ADMIN)
  @Post(':userId')
  registerByAdmin(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
  ) {
    return this.registrationService.registerByAdmin(eventId, userId);
  }

  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':userId')
  unregisterByAdmin(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
  ) {
    return this.registrationService.unregisterByAdmin(eventId, userId);
  }
}
