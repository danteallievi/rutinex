import type { UserRole } from '../users/entities/user.entity';

/**
 * Payload del access JWT. Shape fija — el frontend (y los guards) lo asumen.
 * Fuente de verdad: `docs/04-auth.md` → "Access token (JWT)".
 *
 * Mutuamente excluyente:
 * - SUPERADMIN: `tenantId=null`, `role=null`, `isSuperadmin=true`.
 * - User de tenant: `tenantId` no-null, `role` no-null, `isSuperadmin=false`.
 */
export interface JwtAccessPayload {
  sub: string;
  tenantId: string | null;
  role: UserRole | null;
  isSuperadmin: boolean;
}

/**
 * `req.user` después de pasar por `JwtAuthGuard`. La estrategia mapea el
 * payload al shape interno (sin `iat`/`exp` porque no se usan en handlers).
 */
export interface AuthenticatedUser {
  userId: string;
  tenantId: string | null;
  role: UserRole | null;
  isSuperadmin: boolean;
}
