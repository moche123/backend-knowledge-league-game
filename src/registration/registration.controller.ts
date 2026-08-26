import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
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
@ApiTags('registrations')
@ApiBearerAuth('access-token')
@ApiParam({ name: 'eventId', description: 'Event id' })
@Controller('tournament/events/:eventId/registrations')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @ApiOperation({ summary: 'Register yourself (player)' })
  @Roles(UserRole.PLAYER)
  @Post()
  registerSelf(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrationService.registerSelf(eventId, user.id);
  }

  @ApiOperation({ summary: 'List all registrations for the event' })
  @Get()
  findAll(@Param('eventId') eventId: string) {
    return this.registrationService.findAllForEvent(eventId);
  }

  @ApiOperation({
    summary:
      'Unregister yourself — only while the event is still registration_open',
  })
  @ApiNoContentResponse()
  @Roles(UserRole.PLAYER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('me')
  unregisterSelf(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrationService.unregisterSelf(eventId, user.id);
  }

  @ApiOperation({
    summary: 'Register a specific player on their behalf (admin)',
  })
  @ApiParam({ name: 'userId' })
  @Roles(UserRole.ADMIN)
  @Post(':userId')
  registerByAdmin(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
  ) {
    return this.registrationService.registerByAdmin(eventId, userId);
  }

  @ApiOperation({ summary: 'Unregister a specific player (admin)' })
  @ApiParam({ name: 'userId' })
  @ApiNoContentResponse()
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
