import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { AuthenticatedUser } from './jwt-payload';

/**
 * Exige `req.user.isSuperadmin === true`. Diseñado para encadenarse
 * **después** de `JwtAuthGuard` (que es quien popula `req.user`).
 * Pensado para controllers bajo `/superadmin/*`.
 */
@Injectable()
export class SuperadminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    if (request.user?.isSuperadmin !== true) {
      throw new ForbiddenException({
        code: 'NOT_SUPERADMIN',
        message: 'Esta acción requiere ser SUPERADMIN.',
      });
    }
    return true;
  }
}
