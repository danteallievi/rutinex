import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

/**
 * `UsersModule` depende de `AuthModule` para consumir `PasswordService`
 * (hash + generación de password en el alta/reset de TRAINER) y
 * `RefreshTokenService` (revocación de sesiones en reset/delete). A su vez
 * `AuthModule` depende de `UsersModule` para `UsersService`. La dependencia
 * circular se resuelve con `forwardRef` en ambos lados — patrón estándar
 * de NestJS.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User]), forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
