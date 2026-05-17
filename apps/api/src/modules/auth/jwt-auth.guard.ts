import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Valida el access JWT vía la `JwtStrategy` y popula `req.user` con un
 * `AuthenticatedUser`. En Step 7 se aplica a nivel controller; Step 10
 * lo va a montar como guard global.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
