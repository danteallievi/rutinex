import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

import type { AuthenticatedUser } from './jwt-payload';

/**
 * Inyecta el `tenantId` (string no-null) del JWT en el handler. Pensado para
 * controllers que viven bajo `TenantGuard` — para ese punto el guard ya
 * validó que `req.user.tenantId` matchea el `x-tenant-slug`, así que el
 * valor es seguro.
 *
 * Si el handler corre sin tenant en el JWT (p. ej. SUPERADMIN tocando una
 * ruta tenant-scoped por error), tira 401 — es un bug si llega acá, pero
 * preferimos un 401 explícito antes que un cast a `string` que rompa en DB.
 *
 * Ver `docs/04-auth.md` → "Guards y decoradores".
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Sin tenant en el contexto del request.',
      });
    }
    return tenantId;
  },
);
