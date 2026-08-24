import { Controller, HttpCode, HttpStatus, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './strategies/jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() createAuthDto: CreateAuthDto) {
    return this.authService.register(createAuthDto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() loginAuthDto: LoginAuthDto) {
    return this.authService.login(loginAuthDto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.id);
  }
}
