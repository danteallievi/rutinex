import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import type { Tenant } from '../tenants/entities/tenant.entity';
import { TenantsService } from '../tenants/tenants.service';
import type { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh-token.service';

const TENANT_ID = '99999999-9999-9999-9999-999999999999';

const CTX = { userAgent: 'jest', ip: '127.0.0.1' };

const ISSUED_REFRESH = {
  token: 'refresh-token-emitido',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
};

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

const makeOwner = (overrides: Partial<User> = {}): User => ({
  id: '22222222-2222-2222-2222-222222222222',
  tenantId: TENANT_ID,
  email: 'owner@olimpo.test',
  passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$saltsaltsalt$hashhashhash',
  mustChangePassword: false,
  isSuperadmin: false,
  firstName: 'Olga',
  lastName: 'Owner',
  dni: null,
  role: 'OWNER',
  trainerId: null,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeStudent = (overrides: Partial<User> = {}): User => ({
  id: '33333333-3333-3333-3333-333333333333',
  tenantId: TENANT_ID,
  email: null,
  passwordHash: null,
  mustChangePassword: false,
  isSuperadmin: false,
  firstName: 'Estu',
  lastName: 'Diante',
  dni: '12345678',
  role: 'STUDENT',
  trainerId: null,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeTenant = (overrides: Partial<Tenant> = {}): Tenant => ({
  id: TENANT_ID,
  slug: 'olimpo',
  name: 'Gimnasio Olimpo',
  branding: {},
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  const usersService = {
    findSuperadminByEmail: jest.fn<Promise<User | null>, [string]>(),
    findByEmailAndTenant: jest.fn<Promise<User | null>, [string, string]>(),
    findStudentByDniAndTenant: jest.fn<
      Promise<User | null>,
      [string, string]
    >(),
    findById: jest.fn<Promise<User | null>, [string]>(),
    setPassword: jest.fn<Promise<void>, [string, string]>(),
  };
  const tenantsService = {
    findBySlugIncludingInactive: jest.fn<Promise<Tenant | null>, [string]>(),
    findByIdIncludingInactive: jest.fn<Promise<Tenant | null>, [string]>(),
  };
  const passwordService = {
    verify: jest.fn<Promise<boolean>, [string, string]>(),
    hash: jest.fn<Promise<string>, [string]>(),
  };
  const refreshTokenService = {
    issue: jest.fn<Promise<{ token: string; expiresAt: Date }>, [unknown]>(),
    rotate: jest.fn<
      Promise<{
        token: string;
        expiresAt: Date;
        userId: string;
        tenantId: string | null;
      }>,
      [unknown]
    >(),
    revoke: jest.fn<Promise<boolean>, [string]>(),
    revokeAllForUser: jest.fn<Promise<number>, [string]>(),
  };
  const jwtService = {
    signAsync: jest.fn<Promise<string>, [unknown]>(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    refreshTokenService.issue.mockResolvedValue(ISSUED_REFRESH);
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: TenantsService, useValue: tenantsService },
        { provide: PasswordService, useValue: passwordService },
        { provide: RefreshTokenService, useValue: refreshTokenService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('login (host SUPERADMIN)', () => {
    it('emite JWT + refresh con payload SUPERADMIN', async () => {
      const user = makeSuperadmin();
      usersService.findSuperadminByEmail.mockResolvedValue(user);
      passwordService.verify.mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('jwt-token');

      const res = await service.login(
        'superadmin.rutinex.app',
        { email: 'super@rutinex.app', password: 'cualquiera' },
        CTX,
      );

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        tenantId: null,
        role: null,
        isSuperadmin: true,
      });
      expect(refreshTokenService.issue).toHaveBeenCalledWith({
        userId: user.id,
        tenantId: null,
        userAgent: 'jest',
        ip: '127.0.0.1',
      });
      expect(res.accessToken).toBe('jwt-token');
      expect(res.refreshToken).toBe(ISSUED_REFRESH.token);
      expect(res.refreshTokenExpiresAt).toBe(
        ISSUED_REFRESH.expiresAt.toISOString(),
      );
      expect(res.user).toMatchObject({
        id: user.id,
        role: null,
        isSuperadmin: true,
        mustChangePassword: false,
        tenant: null,
      });
    });

    it('401 si el SUPERADMIN no existe', async () => {
      usersService.findSuperadminByEmail.mockResolvedValue(null);
      await expect(
        service.login(
          'superadmin.rutinex.app',
          { email: 'nope@rutinex.app', password: 'x' },
          CTX,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(passwordService.verify).not.toHaveBeenCalled();
      expect(refreshTokenService.issue).not.toHaveBeenCalled();
    });

    it('401 si la password no matchea', async () => {
      usersService.findSuperadminByEmail.mockResolvedValue(makeSuperadmin());
      passwordService.verify.mockResolvedValue(false);

      await expect(
        service.login(
          'superadmin.localhost',
          { email: 'super@rutinex.app', password: 'mal' },
          CTX,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(refreshTokenService.issue).not.toHaveBeenCalled();
    });

    it('403 USER_INACTIVE si el SUPERADMIN está pausado', async () => {
      usersService.findSuperadminByEmail.mockResolvedValue(
        makeSuperadmin({ isActive: false }),
      );

      await expect(
        service.login(
          'superadmin.rutinex.app',
          { email: 'super@rutinex.app', password: 'x' },
          CTX,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('login (host de tenant — OWNER/TRAINER)', () => {
    it('resuelve tenant + user y emite JWT + refresh con tenantId + role', async () => {
      tenantsService.findBySlugIncludingInactive.mockResolvedValue(
        makeTenant(),
      );
      usersService.findByEmailAndTenant.mockResolvedValue(makeOwner());
      passwordService.verify.mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('jwt-token');

      const res = await service.login(
        'olimpo.rutinex.app',
        { email: 'owner@olimpo.test', password: 'owner-pass-1234' },
        CTX,
      );

      expect(tenantsService.findBySlugIncludingInactive).toHaveBeenCalledWith(
        'olimpo',
      );
      expect(usersService.findByEmailAndTenant).toHaveBeenCalledWith(
        TENANT_ID,
        'owner@olimpo.test',
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: '22222222-2222-2222-2222-222222222222',
        tenantId: TENANT_ID,
        role: 'OWNER',
        isSuperadmin: false,
      });
      expect(refreshTokenService.issue).toHaveBeenCalledWith({
        userId: '22222222-2222-2222-2222-222222222222',
        tenantId: TENANT_ID,
        userAgent: 'jest',
        ip: '127.0.0.1',
      });
      expect(res.user.tenant).toEqual({
        id: TENANT_ID,
        slug: 'olimpo',
        name: 'Gimnasio Olimpo',
      });
      expect(res.refreshToken).toBe(ISSUED_REFRESH.token);
    });

    it('401 genérico si el tenant no existe (no se filtra existencia)', async () => {
      tenantsService.findBySlugIncludingInactive.mockResolvedValue(null);

      await expect(
        service.login(
          'inexistente.rutinex.app',
          { email: 'a@b.test', password: 'x' },
          CTX,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.findByEmailAndTenant).not.toHaveBeenCalled();
      expect(refreshTokenService.issue).not.toHaveBeenCalled();
    });

    it('403 TENANT_INACTIVE si el tenant está pausado', async () => {
      tenantsService.findBySlugIncludingInactive.mockResolvedValue(
        makeTenant({ isActive: false }),
      );

      const err = await service
        .login(
          'olimpo.rutinex.app',
          { email: 'owner@olimpo.test', password: 'x' },
          CTX,
        )
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toMatchObject({
        code: 'TENANT_INACTIVE',
      });
      expect(usersService.findByEmailAndTenant).not.toHaveBeenCalled();
    });

    it('403 USER_INACTIVE si el user está pausado', async () => {
      tenantsService.findBySlugIncludingInactive.mockResolvedValue(
        makeTenant(),
      );
      usersService.findByEmailAndTenant.mockResolvedValue(
        makeOwner({ isActive: false }),
      );

      const err = await service
        .login(
          'olimpo.rutinex.app',
          { email: 'owner@olimpo.test', password: 'x' },
          CTX,
        )
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toMatchObject({
        code: 'USER_INACTIVE',
      });
    });
  });

  describe('login (otros hosts)', () => {
    it('401 genérico si no llega host', async () => {
      await expect(
        service.login(null, { email: 'a@b.test', password: 'x' }, CTX),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tenantsService.findBySlugIncludingInactive).not.toHaveBeenCalled();
    });
  });

  describe('studentLogin', () => {
    it('login OK con DNI válido, emite JWT + refresh con role=STUDENT', async () => {
      tenantsService.findBySlugIncludingInactive.mockResolvedValue(
        makeTenant(),
      );
      usersService.findStudentByDniAndTenant.mockResolvedValue(makeStudent());
      jwtService.signAsync.mockResolvedValue('jwt-token');

      const res = await service.studentLogin(
        'olimpo.rutinex.app',
        { dni: '12345678' },
        CTX,
      );

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: '33333333-3333-3333-3333-333333333333',
        tenantId: TENANT_ID,
        role: 'STUDENT',
        isSuperadmin: false,
      });
      expect(refreshTokenService.issue).toHaveBeenCalledWith({
        userId: '33333333-3333-3333-3333-333333333333',
        tenantId: TENANT_ID,
        userAgent: 'jest',
        ip: '127.0.0.1',
      });
      expect(res.user.role).toBe('STUDENT');
      expect(res.refreshToken).toBe(ISSUED_REFRESH.token);
    });

    it('401 desde el host SUPERADMIN', async () => {
      await expect(
        service.studentLogin(
          'superadmin.rutinex.app',
          { dni: '12345678' },
          CTX,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshTokenService.issue).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('rota y devuelve par nuevo + access JWT con tenant resuelto', async () => {
      refreshTokenService.rotate.mockResolvedValue({
        token: 'nuevo-refresh',
        expiresAt: ISSUED_REFRESH.expiresAt,
        userId: '22222222-2222-2222-2222-222222222222',
        tenantId: TENANT_ID,
      });
      usersService.findById.mockResolvedValue(makeOwner());
      tenantsService.findByIdIncludingInactive.mockResolvedValue(makeTenant());
      jwtService.signAsync.mockResolvedValue('jwt-token-nuevo');

      const res = await service.refresh('viejo-refresh', CTX);

      expect(refreshTokenService.rotate).toHaveBeenCalledWith({
        presentedToken: 'viejo-refresh',
        userAgent: 'jest',
        ip: '127.0.0.1',
      });
      expect(res.accessToken).toBe('jwt-token-nuevo');
      expect(res.refreshToken).toBe('nuevo-refresh');
      expect(res.user.role).toBe('OWNER');
      expect(res.user.tenant?.id).toBe(TENANT_ID);
    });

    it('rota para SUPERADMIN (tenantId null, sin lookup de tenant)', async () => {
      refreshTokenService.rotate.mockResolvedValue({
        token: 'nuevo-refresh',
        expiresAt: ISSUED_REFRESH.expiresAt,
        userId: '11111111-1111-1111-1111-111111111111',
        tenantId: null,
      });
      usersService.findById.mockResolvedValue(makeSuperadmin());
      jwtService.signAsync.mockResolvedValue('jwt-token-nuevo');

      const res = await service.refresh('viejo-refresh', CTX);

      expect(tenantsService.findByIdIncludingInactive).not.toHaveBeenCalled();
      expect(res.user.isSuperadmin).toBe(true);
      expect(res.user.tenant).toBeNull();
    });

    it('401 + revoca el nuevo si el user no existe', async () => {
      refreshTokenService.rotate.mockResolvedValue({
        token: 'nuevo-refresh',
        expiresAt: ISSUED_REFRESH.expiresAt,
        userId: 'no-existe',
        tenantId: null,
      });
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.refresh('viejo-refresh', CTX),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshTokenService.revoke).toHaveBeenCalledWith('nuevo-refresh');
    });

    it('401 + revoca el nuevo si el user está pausado', async () => {
      refreshTokenService.rotate.mockResolvedValue({
        token: 'nuevo-refresh',
        expiresAt: ISSUED_REFRESH.expiresAt,
        userId: '22222222-2222-2222-2222-222222222222',
        tenantId: TENANT_ID,
      });
      usersService.findById.mockResolvedValue(makeOwner({ isActive: false }));

      await expect(
        service.refresh('viejo-refresh', CTX),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshTokenService.revoke).toHaveBeenCalledWith('nuevo-refresh');
    });

    it('401 + revoca el nuevo si el tenant está pausado', async () => {
      refreshTokenService.rotate.mockResolvedValue({
        token: 'nuevo-refresh',
        expiresAt: ISSUED_REFRESH.expiresAt,
        userId: '22222222-2222-2222-2222-222222222222',
        tenantId: TENANT_ID,
      });
      usersService.findById.mockResolvedValue(makeOwner());
      tenantsService.findByIdIncludingInactive.mockResolvedValue(
        makeTenant({ isActive: false }),
      );

      await expect(
        service.refresh('viejo-refresh', CTX),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshTokenService.revoke).toHaveBeenCalledWith('nuevo-refresh');
    });

    it('propaga el 401 cuando rotate falla (token inválido o reusado)', async () => {
      refreshTokenService.rotate.mockRejectedValue(
        new UnauthorizedException({ code: 'INVALID_CREDENTIALS' }),
      );

      await expect(service.refresh('cualquiera', CTX)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(usersService.findById).not.toHaveBeenCalled();
    });
  });

  describe('logout / logout-all', () => {
    it('logout llama a revoke con el token presentado', async () => {
      await service.logout('xyz');
      expect(refreshTokenService.revoke).toHaveBeenCalledWith('xyz');
    });

    it('logoutAll revoca todos los del user', async () => {
      await service.logoutAll('22222222-2222-2222-2222-222222222222');
      expect(refreshTokenService.revokeAllForUser).toHaveBeenCalledWith(
        '22222222-2222-2222-2222-222222222222',
      );
    });
  });

  describe('changePassword', () => {
    it('modo forzado: cambia sin currentPassword + revoca refresh del user', async () => {
      usersService.findById.mockResolvedValue(
        makeOwner({ mustChangePassword: true }),
      );
      passwordService.hash.mockResolvedValue('new-hash');

      await service.changePassword('22222222-2222-2222-2222-222222222222', {
        newPassword: 'nueva-password-1234',
      });

      expect(passwordService.verify).not.toHaveBeenCalled();
      expect(usersService.setPassword).toHaveBeenCalledWith(
        '22222222-2222-2222-2222-222222222222',
        'new-hash',
      );
      expect(refreshTokenService.revokeAllForUser).toHaveBeenCalledWith(
        '22222222-2222-2222-2222-222222222222',
      );
    });

    it('modo forzado: ignora currentPassword si llega', async () => {
      usersService.findById.mockResolvedValue(
        makeOwner({ mustChangePassword: true }),
      );
      passwordService.hash.mockResolvedValue('new-hash');

      await service.changePassword('22222222-2222-2222-2222-222222222222', {
        currentPassword: 'lo-que-sea',
        newPassword: 'nueva-password-1234',
      });

      expect(passwordService.verify).not.toHaveBeenCalled();
      expect(usersService.setPassword).toHaveBeenCalled();
      expect(refreshTokenService.revokeAllForUser).toHaveBeenCalled();
    });

    it('modo voluntario: requiere currentPassword (400 sin ella)', async () => {
      usersService.findById.mockResolvedValue(makeOwner());

      const err = await service
        .changePassword('22222222-2222-2222-2222-222222222222', {
          newPassword: 'nueva-password-1234',
        })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        code: 'CURRENT_PASSWORD_REQUIRED',
      });
      expect(usersService.setPassword).not.toHaveBeenCalled();
      expect(refreshTokenService.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('modo voluntario: rechaza currentPassword incorrecta (401 genérico)', async () => {
      usersService.findById.mockResolvedValue(makeOwner());
      passwordService.verify.mockResolvedValue(false);

      await expect(
        service.changePassword('22222222-2222-2222-2222-222222222222', {
          currentPassword: 'mal',
          newPassword: 'nueva-password-1234',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.setPassword).not.toHaveBeenCalled();
      expect(refreshTokenService.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('modo voluntario: pasa con currentPassword correcta + revoca refresh', async () => {
      usersService.findById.mockResolvedValue(makeOwner());
      passwordService.verify.mockResolvedValue(true);
      passwordService.hash.mockResolvedValue('new-hash');

      await service.changePassword('22222222-2222-2222-2222-222222222222', {
        currentPassword: 'bien',
        newPassword: 'nueva-password-1234',
      });

      expect(usersService.setPassword).toHaveBeenCalledWith(
        '22222222-2222-2222-2222-222222222222',
        'new-hash',
      );
      expect(refreshTokenService.revokeAllForUser).toHaveBeenCalledWith(
        '22222222-2222-2222-2222-222222222222',
      );
    });

    it('401 si el user del JWT ya no existe', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.changePassword('22222222-2222-2222-2222-222222222222', {
          newPassword: 'nueva-password-1234',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshTokenService.revokeAllForUser).not.toHaveBeenCalled();
    });

    it('401 si el user no tiene password (ej. STUDENT)', async () => {
      usersService.findById.mockResolvedValue(makeStudent());

      await expect(
        service.changePassword('33333333-3333-3333-3333-333333333333', {
          newPassword: 'nueva-password-1234',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshTokenService.revokeAllForUser).not.toHaveBeenCalled();
    });
  });
});
