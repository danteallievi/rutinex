import { SetMetadata } from '@nestjs/common';

/**
 * Marca un handler o controller para que el `TenantGuard` global lo saltee.
 * Útil en endpoints autenticados que no viven en contexto de tenant — típico
 * en `/auth/*` (logout, logout-all, change-password): el JWT autentica, pero
 * no hay un `x-tenant-slug` que validar.
 *
 * Ortogonal a `@Public()`:
 * - `@Public()` → skip JwtAuthGuard **y** TenantGuard.
 * - `@SkipTenantGuard()` → JwtAuthGuard sigue corriendo; sólo skip TenantGuard.
 *
 * `/superadmin/*` no necesita este decorador — `TenantGuard` lo skipea por path.
 *
 * Ver ADR-018.
 */
export const SKIP_TENANT_GUARD_KEY = 'skipTenantGuard';

export const SkipTenantGuard = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_TENANT_GUARD_KEY, true);
