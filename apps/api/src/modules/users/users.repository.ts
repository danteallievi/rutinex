import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { TenantScopedRepository } from '../../common/repository/tenant-scoped.repository';
import { User } from './entities/user.entity';

/**
 * Repositorio de `users` con guardas anti-leak por defecto (ver
 * `TenantScopedRepository`). Las queries normales (`find`, `findOne`,
 * `count`, `update`, `delete`) exigen `tenant_id` en el `where`/`criteria`.
 *
 * Las queries genuinamente cross-tenant que sí necesita `auth` (lookup de
 * SUPERADMIN, `findById` desde el JWT, setters por id en `change-password`)
 * usan los métodos `*AcrossTenants` del wrapper. Esos casos están
 * documentados en `UsersService`.
 *
 * Patrón estándar de TypeORM 0.3 + NestJS: extender `Repository<T>` y
 * pasar `(Entity, dataSource.createEntityManager())` al super.
 */
@Injectable()
export class UsersRepository extends TenantScopedRepository<User> {
  constructor(dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }
}
