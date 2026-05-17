import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import type { LoginDto } from './dto/login.dto';
import { isSuperadminHost } from './host';
import type { JwtAccessPayload } from './jwt-payload';
import { PasswordService } from './password.service';

/**
 * Shape de la response del login. Step 7 lo emite solo para SUPERADMIN; Step 8
 * extenderá para users de tenant. Step 9 agregará `refreshToken`.
 *
 * Fuente: `docs/04-auth.md` → "Flujos / Login".
 */
export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    role: User['role'];
    isSuperadmin: boolean;
    mustChangePassword: boolean;
    firstName: string;
    lastName: string;
    tenant: null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Login resuelto por host. En Step 7 **solo** atiende el caso SUPERADMIN
   * (host `superadmin.*`); cualquier otro host devuelve 401 genérico —
   * no se filtra existencia entre superficies (ver docs/04-auth.md).
   *
   * Step 8 va a extender este método para resolver `tenant_id` desde
   * `<slug>.*` y emitir JWTs de OWNER/TRAINER.
   */
  async login(hostname: string | null, dto: LoginDto): Promise<LoginResponse> {
    if (!isSuperadminHost(hostname)) {
      throw this.invalidCredentials();
    }
    return this.loginSuperadmin(dto);
  }

  private async loginSuperadmin(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.usersService.findSuperadminByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw this.invalidCredentials();
    }
    if (!user.isActive) {
      throw new ForbiddenException({
        code: 'USER_INACTIVE',
        message: 'Tu cuenta está pausada.',
      });
    }
    const valid = await this.passwordService.verify(
      user.passwordHash,
      dto.password,
    );
    if (!valid) {
      throw this.invalidCredentials();
    }

    const payload: JwtAccessPayload = {
      sub: user.id,
      tenantId: null,
      role: null,
      isSuperadmin: true,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        role: null,
        isSuperadmin: true,
        mustChangePassword: user.mustChangePassword,
        firstName: user.firstName,
        lastName: user.lastName,
        tenant: null,
      },
    };
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'Email o contraseña inválidos.',
    });
  }
}
