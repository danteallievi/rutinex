import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { UserRole } from '../users/entities/user.entity';
import type { AuthenticatedUser } from './jwt-payload';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';

/**
 * Guard global. Aplica a cualquier ruta autenticada que declare roles
 * permitidos con `@Roles(...)`. Reglas:
 *
 *   1. Si la ruta es `@Public()` → skip (consistente con `TenantGuard`).
 *   2. Si no hay meta `@Roles` en handler ni en clase → skip. El endpoint
 *      queda abierto a cualquier user autenticado (típicamente filtrado por
 *      `TenantGuard` previo). No exigir rol es la default segura: el caller
 *      tiene que ser explícito sobre qué roles aceptar.
 *   3. SUPERADMIN bypassa (`req.user.isSuperadmin === true`). Su `role` es
 *      `null` y sus rutas reales son `/superadmin/*` con `SuperadminGuard`.
 *      Ver ADR-019.
 *   4. Si el rol del JWT no está en la lista permitida → 403 `FORBIDDEN_ROLE`.
 *
 * Orden de registración: después de `JwtAuthGuard` y `TenantGuard`.
 * Ver `docs/04-auth.md` → "Guards y decoradores".
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<
      readonly UserRole[] | undefined
    >(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);

    // Sin meta @Roles → no exigir rol. Endpoint abierto a cualquier user
    // autenticado del tenant (TenantGuard ya validó el match).
    if (!required || required.length === 0) return true;

    const user = ctx
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>().user;

    if (!user) {
      // Defensivo: si llegamos acá sin user es que el JwtAuthGuard global
      // no corrió antes — bug de orden de guards.
      throw new UnauthorizedException();
    }

    // SUPERADMIN bypassa. Ver ADR-019.
    if (user.isSuperadmin) return true;

    if (user.role !== null && required.includes(user.role)) return true;

    throw new ForbiddenException({
      code: 'FORBIDDEN_ROLE',
      message: 'Tu rol no tiene permiso para esta acción.',
    });
  }
}
