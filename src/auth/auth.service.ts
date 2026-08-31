import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { CreateAuthDto } from './dto/create-auth.dto';
import { CreateUserByAdminDto } from './dto/create-user-by-admin.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { AuthResponseDto, PublicUserDto } from './dto/auth-response.dto';
import { User, UserRole } from './entities/user.entity';
import { JwtPayload } from './strategies/jwt.strategy';

const SALT_ROUNDS = 10;

interface RefreshPayload {
  sub: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(createAuthDto: CreateAuthDto): Promise<AuthResponseDto> {
    const existing = await this.usersRepository.findOne({
      where: { email: createAuthDto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(createAuthDto.password, SALT_ROUNDS);

    // Public registration: always role "player" (decision closed in CLAUDE.md).
    const user = this.usersRepository.create({
      name: createAuthDto.name,
      email: createAuthDto.email,
      passwordHash,
      role: UserRole.PLAYER,
    });
    await this.usersRepository.save(user);

    return this.buildAuthResponse(user);
  }

  async login(loginAuthDto: LoginAuthDto): Promise<AuthResponseDto> {
    const user = await this.usersRepository.findOne({
      where: { email: loginAuthDto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      loginAuthDto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  // Rotates the refresh token on every use: a consumed old one no longer works,
  // so a stolen token reused by an attacker after the real owner (or vice versa)
  // gets caught as an invalid credential on the next attempt.
  async refreshTokens(refreshToken: string): Promise<AuthResponseDto> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user || !user.refreshTokenHash || !user.refreshTokenExpiresAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (user.refreshTokenExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenMatches = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash,
    );
    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.buildAuthResponse(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    });
  }

  // Admin creates a player or referee account directly (never admin — that
  // stays a manual DB bootstrap). Same uniqueness/hashing rules as public
  // register(), just with an admin-chosen role and no tokens issued for it —
  // the admin isn't logging in as this new account.
  async createUserAsAdmin(dto: CreateUserByAdminDto): Promise<PublicUserDto> {
    const existing = await this.usersRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = this.usersRepository.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: dto.role,
    });
    await this.usersRepository.save(user);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  // Admin-only directory search, used to pick an existing player to register
  // for an event (no account creation here — that's a separate admin feature).
  async listPlayers(search?: string): Promise<PublicUserDto[]> {
    const query = this.usersRepository
      .createQueryBuilder('u')
      .where('u.role = :role', { role: UserRole.PLAYER });

    const trimmed = search?.trim();
    if (trimmed) {
      query.andWhere('(u.name ILIKE :search OR u.email ILIKE :search)', {
        search: `%${trimmed}%`,
      });
    }

    const users = await query.orderBy('u.name', 'ASC').limit(20).getMany();
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    }));
  }

  // Admin-only — resolves a single user's public info (e.g. displaying a real
  // name for an event's registrations, which only store a userId).
  async getPublicUser(userId: string): Promise<PublicUserDto> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User #${userId} not found`);
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  private async buildAuthResponse(user: User): Promise<AuthResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '30d',
    );
    const refreshToken = await this.jwtService.signAsync<RefreshPayload>(
      { sub: user.id },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn as JwtSignOptions['expiresIn'],
      },
    );

    await this.usersRepository.update(user.id, {
      refreshTokenHash: await bcrypt.hash(refreshToken, SALT_ROUNDS),
      refreshTokenExpiresAt: new Date(
        Date.now() + parseDurationMs(refreshExpiresIn),
      ),
    });

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }
}

// Converts strings like "30d" / "12h" / "3600" (seconds) to their ms equivalent,
// so refresh_token_expires_at can be stored without an external parser dependency.
function parseDurationMs(duration: string): number {
  const match = /^(\d+)(ms|s|m|h|d)?$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }
  const value = Number(match[1]);
  const unit = match[2] ?? 's';
  const unitMs: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * unitMs[unit];
}
