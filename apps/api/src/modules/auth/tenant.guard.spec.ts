import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantsService } from '../tenants/tenants.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { SKIP_TENANT_GUARD_KEY } from './skip-tenant-guard.decorator';
import { TenantGuard } from './tenant.guard';

interface FakeRequest {
  path: string;
  headers: Record<string, string | undefined>;
  user?: {
    userId: string;
    tenantId: string | null;
    role: 'OWNER' | 'TRAINER' | 'STUDENT' | null;
    isSuperadmin: boolean;
  };
}

describe('TenantGuard', () => {
  let reflector: Reflector;
  let tenantsService: jest.Mocked<TenantsService>;
  let guard: TenantGuard;

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

  beforeEach(() => {
    reflector = new Reflector();
    tenantsService = {
      findBySlugIncludingInactive: jest.fn(),
    } as unknown as jest.Mocked<TenantsService>;
    guard = new TenantGuard(reflector, tenantsService);
  });

  describe('skip rules', () => {
    it('skipea endpoints marcados @Public', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return true;
        return false;
      });
      const ctx = makeContext({
        path: '/users',
        headers: {},
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const spy = tenantsService.findBySlugIncludingInactive;
      expect(spy).not.toHaveBeenCalled();
    });

    it('skipea endpoints marcados @SkipTenantGuard', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === SKIP_TENANT_GUARD_KEY) return true;
        return false;
      });
      const ctx = makeContext({
        path: '/auth/change-password',
        headers: {},
        user: ownerUser,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('skipea exactamente /superadmin', async () => {
      const ctx = makeContext({
        path: '/superadmin',
        headers: {},
        user: ownerUser,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('skipea /superadmin/ping y /superadmin/tenants', async () => {
      for (const path of ['/superadmin/ping', '/superadmin/tenants']) {
        const ctx = makeContext({
          path,
          headers: {},
          user: ownerUser,
        });
        await expect(guard.canActivate(ctx)).resolves.toBe(true);
      }
    });

    it('NO skipea /superadminish (prefijo falso)', async () => {
      const ctx = makeContext({
        path: '/superadminish',
        headers: {},
        user: ownerUser,
      });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('validación de slug + tenant', () => {
    it('401 si no hay user (bug de orden de guards)', async () => {
      const ctx = makeContext({
        path: '/users',
        headers: { 'x-tenant-slug': 'olimpo' },
      });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('400 TENANT_SLUG_REQUIRED si falta el header', async () => {
      const ctx = makeContext({
        path: '/users',
        headers: {},
        user: ownerUser,
      });
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        response: { code: 'TENANT_SLUG_REQUIRED' },
      });
    });

    it('400 TENANT_SLUG_REQUIRED si el header está vacío', async () => {
      const ctx = makeContext({
        path: '/users',
        headers: { 'x-tenant-slug': '   ' },
        user: ownerUser,
      });
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        response: { code: 'TENANT_SLUG_REQUIRED' },
      });
    });

    it('403 TENANT_MISMATCH si el slug no existe (no se filtra existencia)', async () => {
      tenantsService.findBySlugIncludingInactive.mockResolvedValue(null);
      const ctx = makeContext({
        path: '/users',
        headers: { 'x-tenant-slug': 'no-existe' },
        user: ownerUser,
      });
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        response: { code: 'TENANT_MISMATCH' },
      });
    });

    it('403 TENANT_MISMATCH si el tenant existe pero no matchea el JWT', async () => {
      tenantsService.findBySlugIncludingInactive.mockResolvedValue({
        id: 'tenant-b',
        slug: 'rival',
        isActive: true,
      } as Tenant);
      const ctx = makeContext({
        path: '/users',
        headers: { 'x-tenant-slug': 'rival' },
        user: ownerUser,
      });
      await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        response: { code: 'TENANT_MISMATCH' },
      });
    });

    it('403 TENANT_INACTIVE si matchea pero está pausado', async () => {
      tenantsService.findBySlugIncludingInactive.mockResolvedValue({
        id: 'tenant-a',
        slug: 'olimpo',
        isActive: false,
      } as Tenant);
      const ctx = makeContext({
        path: '/users',
        headers: { 'x-tenant-slug': 'olimpo' },
        user: ownerUser,
      });
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        response: { code: 'TENANT_INACTIVE' },
      });
    });

    it('200 si slug existe, está activo y matchea el JWT', async () => {
      tenantsService.findBySlugIncludingInactive.mockResolvedValue({
        id: 'tenant-a',
        slug: 'olimpo',
        isActive: true,
      } as Tenant);
      const ctx = makeContext({
        path: '/users',
        headers: { 'x-tenant-slug': 'olimpo' },
        user: ownerUser,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('SUPERADMIN sin tenant en JWT → 403 TENANT_MISMATCH (no debería tocar rutas tenant)', async () => {
      tenantsService.findBySlugIncludingInactive.mockResolvedValue({
        id: 'tenant-a',
        slug: 'olimpo',
        isActive: true,
      } as Tenant);
      const ctx = makeContext({
        path: '/users',
        headers: { 'x-tenant-slug': 'olimpo' },
        user: {
          userId: 'super-1',
          tenantId: null,
          role: null,
          isSuperadmin: true,
        },
      });
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        response: { code: 'TENANT_MISMATCH' },
      });
    });

    it('normaliza el slug (case-insensitive + trim)', async () => {
      tenantsService.findBySlugIncludingInactive.mockResolvedValue({
        id: 'tenant-a',
        slug: 'olimpo',
        isActive: true,
      } as Tenant);
      const ctx = makeContext({
        path: '/users',
        headers: { 'x-tenant-slug': '  OLIMPO  ' },
        user: ownerUser,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const spy = tenantsService.findBySlugIncludingInactive;
      expect(spy).toHaveBeenCalledWith('olimpo');
    });
  });
});
