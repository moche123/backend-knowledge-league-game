import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
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

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
