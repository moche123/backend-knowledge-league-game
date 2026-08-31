import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthResponseDto, PublicUserDto } from './dto/auth-response.dto';
import { CreateAuthDto } from './dto/create-auth.dto';
import { CreateUserByAdminDto } from './dto/create-user-by-admin.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from './entities/user.entity';
import type { AuthenticatedUser } from './strategies/jwt.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new account (always role "player")' })
  @ApiOkResponse({ type: AuthResponseDto })
  @Public()
  @Post('register')
  register(@Body() createAuthDto: CreateAuthDto) {
    return this.authService.register(createAuthDto);
  }

  @ApiOperation({ summary: 'Log in' })
  @ApiOkResponse({ type: AuthResponseDto })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() loginAuthDto: LoginAuthDto) {
    return this.authService.login(loginAuthDto);
  }

  @ApiOperation({
    summary: 'Rotate the refresh token — the old one stops working once used',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @ApiOperation({ summary: 'Invalidate the stored refresh token' })
  @ApiNoContentResponse()
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.id);
  }

  @ApiOperation({
    summary: 'Create a player or referee account (admin)',
    description:
      'Role is restricted to player/referee — admin accounts are never created through this, only bootstrapped by hand in the DB.',
  })
  @ApiOkResponse({ type: PublicUserDto })
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Post('users')
  createUser(@Body() dto: CreateUserByAdminDto) {
    return this.authService.createUserAsAdmin(dto);
  }

  @ApiOperation({
    summary: 'Search existing player accounts (admin)',
    description:
      'Used to pick an existing player when registering them for an event — not account creation.',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiOkResponse({ type: PublicUserDto, isArray: true })
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Get('users')
  listPlayers(@Query('search') search?: string) {
    return this.authService.listPlayers(search);
  }

  @ApiOperation({ summary: "Get one user's public info (admin)" })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ type: PublicUserDto })
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.authService.getPublicUser(id);
  }
}
