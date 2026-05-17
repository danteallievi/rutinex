import { SetMetadata } from '@nestjs/common';

/**
 * Marca un handler o controller como público — el `JwtAuthGuard` global lo
 * salta. Usado en login, student-login, healthcheck y endpoints públicos
 * de tenants. Ver `docs/04-auth.md` → "Guards y decoradores".
 */
export const IS_PUBLIC_KEY = 'isPublic';

export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
