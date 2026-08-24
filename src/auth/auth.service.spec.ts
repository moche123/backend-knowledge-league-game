import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: {} },
        {
          provide: JwtService,
          useValue: { sign: vi.fn(), signAsync: vi.fn(), verifyAsync: vi.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: vi.fn(), getOrThrow: vi.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
