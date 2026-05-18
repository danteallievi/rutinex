import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';
import { SuperadminController } from './superadmin.controller';
import { SuperadminTenantsController } from './superadmin-tenants.controller';
import { SuperadminTenantsService } from './superadmin-tenants.service';

/**
 * `SuperadminModule` aloja todas las rutas `/superadmin/*`. Importa
 * `AuthModule` (para `SuperadminGuard`, `PasswordService` y
 * `RefreshTokenService`) y `TenantsModule` (para que la entidad `Tenant`
 * esté registrada en el `TypeOrmModule` raíz — la usamos vía
 * `DataSource.getRepository(Tenant)` en `SuperadminTenantsService`).
 *
 * NO importa `UsersModule`: la entidad `User` ya queda registrada por
 * `UsersModule` en `AppModule`, y el service usa `DataSource` directo
 * para queries y transacciones cross-tenant.
 */
@Module({
  imports: [AuthModule, TenantsModule],
  controllers: [SuperadminController, SuperadminTenantsController],
  providers: [SuperadminTenantsService],
})
export class SuperadminModule {}
