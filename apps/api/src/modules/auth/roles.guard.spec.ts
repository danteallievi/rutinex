import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { UserRole } from '../users/entities/user.entity';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';
import { RolesGuard } from './roles.guard';

interface FakeRequest {
  user?: {
    userId: string;
    tenantId: string | null;
    role: UserRole | null;
    isSuperadmin: boolean;
  };
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  const makeContext = (req: FakeRequest): ExecutionContext => {
    const handler = (): void => {};
    const klass = class Dummy {};
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
      getHandler: () => handler,
      getClass: () => klass,
      getArgs: () => [],
      getArgByIndex: () => undefined,
      switchToRpc: () => ({}) as never,
      switchToWs: () => ({}) as never,
      getType: () => 'http' as never,
    } as unknown as ExecutionContext;
  };

  const ownerUser = {
    userId: 'user-1',
    tenantId: 'tenant-a',
    role: 'OWNER' as const,
    isSuperadmin: false,
  };
  const trainerUser = {
    userId: 'user-2',
    tenantId: 'tenant-a',
    role: 'TRAINER' as const,
    isSuperadmin: false,
  };
  const studentUser = {
    userId: 'user-3',
    tenantId: 'tenant-a',
    role: 'STUDENT' as const,
    isSuperadmin: false,
  };
  const superUser = {
    userId: 'super-1',
    tenantId: null,
    role: null,
    isSuperadmin: true,
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('skipea endpoints marcados @Public (no chequea rol)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return true;
      return undefined;
    });
    const ctx = makeContext({});
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('skipea endpoints sin meta @Roles (rol no exigido)', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation(() => undefined);
    const ctx = makeContext({ user: studentUser });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('skipea cuando la meta @Roles es un array vacío', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ROLES_KEY) return [];
      return undefined;
    });
    const ctx = makeContext({ user: studentUser });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('SUPERADMIN bypassa aunque el rol no esté en la lista (ADR-019)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ROLES_KEY) return ['OWNER'] as const;
      return undefined;
    });
    const ctx = makeContext({ user: superUser });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('OWNER pasa cuando la meta exige @Roles("OWNER")', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ROLES_KEY) return ['OWNER'] as const;
      return undefined;
    });
    const ctx = makeContext({ user: ownerUser });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('TRAINER pasa cuando la meta exige @Roles("OWNER", "TRAINER")', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ROLES_KEY) return ['OWNER', 'TRAINER'] as const;
      return undefined;
    });
    const ctx = makeContext({ user: trainerUser });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('STUDENT con @Roles("OWNER") → 403 FORBIDDEN_ROLE', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ROLES_KEY) return ['OWNER'] as const;
      return undefined;
    });
    const ctx = makeContext({ user: studentUser });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    try {
      guard.canActivate(ctx);
    } catch (err) {
      expect(err).toMatchObject({
        response: { code: 'FORBIDDEN_ROLE' },
      });
    }
  });

  it('TRAINER con @Roles("OWNER") → 403 FORBIDDEN_ROLE', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ROLES_KEY) return ['OWNER'] as const;
      return undefined;
    });
    const ctx = makeContext({ user: trainerUser });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('401 si no hay user en req (bug de orden de guards)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ROLES_KEY) return ['OWNER'] as const;
      return undefined;
    });
    const ctx = makeContext({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('user con role=null y NO superadmin → 403 (caso imposible pero defensivo)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ROLES_KEY) return ['OWNER'] as const;
      return undefined;
    });
    const ctx = makeContext({
      user: {
        userId: 'weird',
        tenantId: 'tenant-a',
        role: null,
        isSuperadmin: false,
      },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('handler-level @Roles override class-level @Roles (Reflector.getAllAndOverride)', () => {
    // En `getAllAndOverride([handler, class])`, handler gana. Acá simulamos
    // que el handler tiene @Roles('TRAINER') aunque la clase tenga otra cosa
    // — el guard sólo ve lo que devuelve el Reflector (handler primero).
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ROLES_KEY) return ['TRAINER'] as const;
      return undefined;
    });
    const ctx = makeContext({ user: trainerUser });
    expect(guard.canActivate(ctx)).toBe(true);

    const ctx2 = makeContext({ user: ownerUser });
    expect(() => guard.canActivate(ctx2)).toThrow(ForbiddenException);
  });
});
