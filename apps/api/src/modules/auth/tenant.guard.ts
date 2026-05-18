import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { TenantsService } from '../tenants/tenants.service';
import type { AuthenticatedUser } from './jwt-payload';
import { IS_PUBLIC_KEY } from './public.decorator';
import { SKIP_TENANT_GUARD_KEY } from './skip-tenant-guard.decorator';

/**
 * Header obligatorio para rutas tenant-scoped. El frontend lo envía en cada
 * request con el slug del subdominio. El guard valida que ese slug coincida
 * con el `tenantId` del JWT (defensa contra reusar el JWT en otro tenant).
 *
 * Fuente: `docs/03-multi-tenancy.md` → "Validación en el API".
 */
const TENANT_SLUG_HEADER = 'x-tenant-slug';

/**
 * Prefijos de path que el guard nunca toca. Las rutas `/superadmin/*` viven
 * con su propio `SuperadminGuard` y operan cross-tenant por diseño.
 */
const SUPERADMIN_PATH_PREFIX = '/superadmin';

/**
 * Guard global. Aplica a cualquier ruta autenticada que vive en contexto de
 * tenant. Skipea (en este orden) tres categorías:
 *
 *   1. `@Public()` — endpoints sin auth (login, healthcheck, etc.).
 *   2. `/superadmin/*` — surface del SUPERADMIN, cross-tenant por diseño.
 *   3. `@SkipTenantGuard()` — endpoints autenticados sin contexto de tenant
 *      (`/auth/logout`, `/auth/change-password`, etc.).
 *
 * Para el resto: exige `x-tenant-slug` y lo resuelve contra el `tenantId` del
 * JWT. Si no matchea (o el slug no existe, o el tenant está pausado),
 * devuelve 4xx con `code` parseable (`TENANT_SLUG_REQUIRED`, `TENANT_MISMATCH`,
 * `TENANT_INACTIVE`). Ver ADR-018 para por qué `slug inexistente` se colapsa
 * con `slug que no matchea` en `TENANT_MISMATCH` (no filtrar existencia).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantsService: TenantsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_GUARD_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (skip) return true;

    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    if (this.isSuperadminPath(req)) return true;

    const user = req.user;
    if (!user) {
      // Defensivo: si llegamos acá sin user es que el JwtAuthGuard global
      // no corrió antes — bug de orden de guards. Mejor 401 explícito que
      // un null-deref.
      throw new UnauthorizedException();
    }

    const slug = this.extractSlug(req);
    if (!slug) {
      throw new BadRequestException({
        code: 'TENANT_SLUG_REQUIRED',
        message: 'Falta el header x-tenant-slug.',
      });
    }

    const tenant = await this.tenantsService.findBySlugIncludingInactive(slug);
    if (!tenant || tenant.id !== user.tenantId) {
      // Colapsamos "slug inexistente" con "slug no matchea el JWT" en el
      // mismo 403 — no filtramos si tenant B existe o no. Ver ADR-018.
      throw new ForbiddenException({
        code: 'TENANT_MISMATCH',
        message: 'El tenant no coincide con tu sesión.',
      });
    }
    if (!tenant.isActive) {
      throw new ForbiddenException({
        code: 'TENANT_INACTIVE',
        message: 'Tu cuenta está pausada. Contactá a tu vendedor por WhatsApp.',
      });
    }

    return true;
  }

  /**
   * `true` si el path empieza con `/superadmin/` o es exactamente `/superadmin`.
   * Importante: `/superadminish` NO debe matchear — por eso el chequeo es
   * `path === '/superadmin' || path.startsWith('/superadmin/')`.
   */
  private isSuperadminPath(req: Request): boolean {
    const path = req.path;
    return (
      path === SUPERADMIN_PATH_PREFIX ||
      path.startsWith(`${SUPERADMIN_PATH_PREFIX}/`)
    );
  }

  private extractSlug(req: Request): string | null {
    const raw = req.headers[TENANT_SLUG_HEADER];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : null;
  }
}
