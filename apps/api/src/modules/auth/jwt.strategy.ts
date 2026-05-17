import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AuthenticatedUser, JwtAccessPayload } from './jwt-payload';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error(
        'JWT_ACCESS_SECRET no está definida (ver apps/api/.env.example).',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms: ['HS256'],
    });
  }

  validate(payload: JwtAccessPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      isSuperadmin: payload.isSuperadmin,
    };
  }
}
