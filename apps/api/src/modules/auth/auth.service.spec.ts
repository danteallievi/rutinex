import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import type { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

const makeSuperadmin = (overrides: Partial<User> = {}): User => ({
  id: '11111111-1111-1111-1111-111111111111',
  tenantId: null,
  email: 'super@rutinex.app',
  passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$saltsaltsalt$hashhashhash',
  mustChangePassword: false,
  isSuperadmin: true,
  firstName: 'Super',
  lastName: 'Admin',
  dni: null,
  role: null,
  trainerId: null,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  const usersService = {
    findSuperadminByEmail: jest.fn<Promise<User | null>, [string]>(),
  };
  const passwordService = {
    verify: jest.fn<Promise<boolean>, [string, string]>(),
  };
  const jwtService = {
    signAsync: jest.fn<Promise<string>, [unknown]>(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: PasswordService, useValue: passwordService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('login (host SUPERADMIN)', () => {
    it('emite JWT con payload SUPERADMIN', async () => {
      const user = makeSuperadmin();
      usersService.findSuperadminByEmail.mockResolvedValue(user);
      passwordService.verify.mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('jwt-token');

      const res = await service.login('superadmin.rutinex.app', {
        email: 'super@rutinex.app',
        password: 'cualquiera',
      });

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        tenantId: null,
        role: null,
        isSuperadmin: true,
      });
      expect(res).toEqual({
        accessToken: 'jwt-token',
        user: {
          id: user.id,
          role: null,
          isSuperadmin: true,
          mustChangePassword: false,
          firstName: 'Super',
          lastName: 'Admin',
          tenant: null,
        },
      });
    });

    it('401 si el SUPERADMIN no existe', async () => {
      usersService.findSuperadminByEmail.mockResolvedValue(null);
      await expect(
        service.login('superadmin.rutinex.app', {
          email: 'nope@rutinex.app',
          password: 'x',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(passwordService.verify).not.toHaveBeenCalled();
    });

    it('401 si la password no matchea', async () => {
      usersService.findSuperadminByEmail.mockResolvedValue(makeSuperadmin());
      passwordService.verify.mockResolvedValue(false);

      await expect(
        service.login('superadmin.localhost', {
          email: 'super@rutinex.app',
          password: 'mal',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('403 USER_INACTIVE si el SUPERADMIN está pausado', async () => {
      usersService.findSuperadminByEmail.mockResolvedValue(
        makeSuperadmin({ isActive: false }),
      );

      await expect(
        service.login('superadmin.rutinex.app', {
          email: 'super@rutinex.app',
          password: 'x',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('login (otros hosts)', () => {
    it('401 genérico desde host de tenant (sin filtrar existencia)', async () => {
      await expect(
        service.login('olimpo.rutinex.app', {
          email: 'super@rutinex.app',
          password: 'x',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.findSuperadminByEmail).not.toHaveBeenCalled();
    });

    it('401 si no llega host', async () => {
      await expect(
        service.login(null, { email: 'super@rutinex.app', password: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
