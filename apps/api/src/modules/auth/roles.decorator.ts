import { SetMetadata } from '@nestjs/common';

import type { UserRole } from '../users/entities/user.entity';

/**
 * Marca un handler o controller con los roles permitidos para acceder. El
 * `RolesGuard` global lee esta meta con `Reflector.getAllAndOverride` (handler
 * gana sobre clase). Si la meta no existe en ningún nivel, el guard skipea —
 * el endpoint queda abierto a cualquier user autenticado del tenant.
 *
 * Aplica sobre roles **de tenant**: `OWNER`, `TRAINER`, `STUDENT`. El SUPERADMIN
 * tiene `role: null` en el JWT y se rige por `SuperadminGuard` en sus rutas
 * `/superadmin/*`. Si por algún diseño futuro un SUPERADMIN tocara una ruta
 * con `@Roles`, el `RolesGuard` lo deja pasar (ver ADR-019).
 *
 * Ejemplo: `@Roles('OWNER')`, `@Roles('OWNER', 'TRAINER')`.
 */
export const ROLES_KEY = 'roles';

export const Roles = (
  ...roles: readonly UserRole[]
): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);
