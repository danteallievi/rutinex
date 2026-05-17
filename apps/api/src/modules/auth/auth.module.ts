import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { PasswordService } from './password.service';
import { SuperadminGuard } from './superadmin.guard';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_ACCESS_SECRET');
        if (!secret) {
          throw new Error(
            'JWT_ACCESS_SECRET no está definida (ver apps/api/.env.example).',
          );
        }
        return {
          secret,
          signOptions: { algorithm: 'HS256', expiresIn: '15m' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    JwtStrategy,
    JwtAuthGuard,
    SuperadminGuard,
  ],
  exports: [PasswordService, JwtAuthGuard, SuperadminGuard],
})
export class AuthModule {}
