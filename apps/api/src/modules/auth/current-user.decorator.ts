import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

import type { AuthenticatedUser } from './jwt-payload';

/**
 * Inyecta el `AuthenticatedUser` populado por el `JwtAuthGuard` en el handler.
 * Pensado para controllers que ya pasaron el guard global; si por algún bug
 * el handler corre sin `req.user`, tira 401 explícito en lugar de devolver
 * `undefined` y romper más abajo en la DB.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!req.user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Sin user en el contexto del request.',
      });
    }
    return req.user;
  },
);
