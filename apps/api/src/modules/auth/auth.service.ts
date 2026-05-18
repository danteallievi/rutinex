import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { Tenant } from '../tenants/entities/tenant.entity';
import { TenantsService } from '../tenants/tenants.service';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { StudentLoginDto } from './dto/student-login.dto';
import { extractTenantSlug, isSuperadminHost } from './host';
import type { JwtAccessPayload } from './jwt-payload';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh-token.service';

/**
 * Datos del cliente (user agent + IP) que el controller extrae del request
 * y pasa al service para persistir en `refresh_tokens` y dejar trazabilidad
 * de "mis sesiones".
 */
export interface ClientContext {
  userAgent: string | null;
  ip: string | null;
}

interface LoginResponseTenant {
  id: string;
  slug: string;
  name: string;
}

/**
 * Shape de la response del login y del refresh.
 *
 * Fuente: `docs/04-auth.md` → "Flujos / Login".
 */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: {
    id: string;
    role: UserRole | null;
    isSuperadmin: boolean;
    mustChangePassword: boolean;
    firstName: string;
    lastName: string;
    tenant: LoginResponseTenant | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly passwordService: PasswordService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Login resuelto por host:
   * - `superadmin.<...>` → flujo SUPERADMIN.
   * - `<slug>.<...>` con slug válido → flujo tenant (OWNER/TRAINER).
   * - Cualquier otro host → 401 genérico (no se filtra existencia).
   */
  async login(
    hostname: string | null,
    dto: LoginDto,
    ctx: ClientContext,
  ): Promise<LoginResponse> {
    if (isSuperadminHost(hostname)) {
      return this.loginSuperadmin(dto, ctx);
    }
    const slug = extractTenantSlug(hostname);
    if (slug) {
      return this.loginTenantUser(slug, dto, ctx);
    }
    throw this.invalidCredentials();
  }

  /**
   * Login por DNI del STUDENT. Sólo válido en hosts de tenant; si llega desde
   * `superadmin.*` (o cualquier host sin slug), devuelve 401 genérico.
   */
  async studentLogin(
    hostname: string | null,
    dto: StudentLoginDto,
    ctx: ClientContext,
  ): Promise<LoginResponse> {
    if (isSuperadminHost(hostname)) {
      throw this.invalidCredentials();
    }
    const slug = extractTenantSlug(hostname);
    if (!slug) {
      throw this.invalidCredentials();
    }
    return this.loginStudent(slug, dto, ctx);
  }

  /**
   * Rota un refresh token y emite un par nuevo (`accessToken` + `refreshToken`).
   *
   * Fallas posibles → todas 401 genérico:
   * - El refresh no existe / está expirado.
   * - El refresh ya estaba revocado → reuse detection: el service revoca todos
   *   los refresh activos del user.
   * - El user no existe / está inactivo.
   * - El user tiene tenant pausado / inexistente.
   *
   * En los últimos dos casos revocamos el refresh recién emitido (no queremos
   * dejar un token vivo de un user pausado).
   */
  async refresh(
    presentedToken: string,
    ctx: ClientContext,
  ): Promise<LoginResponse> {
    const rotated = await this.refreshTokenService.rotate({
      presentedToken,
      userAgent: ctx.userAgent,
      ip: ctx.ip,
    });

    const user = await this.usersService.findById(rotated.userId);
    if (!user || !user.isActive) {
      await this.refreshTokenService.revoke(rotated.token);
      throw this.invalidCredentials();
    }

    let tenant: Tenant | null = null;
    if (user.tenantId) {
      tenant = await this.tenantsService.findByIdIncludingInactive(
        user.tenantId,
      );
      if (!tenant || !tenant.isActive) {
        await this.refreshTokenService.revoke(rotated.token);
        throw this.invalidCredentials();
      }
    }

    const accessToken = await this.signAccessToken(user, tenant);
    return this.assembleResponse(user, tenant, accessToken, rotated);
  }

  /**
   * Revoca un refresh token. Si el token no existe o ya estaba revocado,
   * es no-op (sin filtrar existencia). Bearer requerido en el endpoint.
   */
  async logout(presentedToken: string): Promise<void> {
    await this.refreshTokenService.revoke(presentedToken);
  }

  /**
   * Revoca todos los refresh tokens activos del user del JWT. Bearer requerido.
   */
  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenService.revokeAllForUser(userId);
  }

  /**
   * Cambia la password del user autenticado.
   *
   * - Si `must_change_password=true`: modo forzado. Acepta sólo `newPassword`
   *   (si llega `currentPassword`, se ignora).
   * - Si `must_change_password=false`: modo voluntario. Requiere
   *   `currentPassword`; si falta, 400 `CURRENT_PASSWORD_REQUIRED`. Si no
   *   matchea, 401 genérico.
   *
   * En ambos modos, revoca todos los refresh tokens del user (Step 9), forzando
   * re-login en otros devices.
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.passwordHash) {
      // El JWT venía válido pero el user ya no tiene password (ej. STUDENT
      // sin password, o user eliminado entre el sign y el verify). Tratamos
      // como 401 genérico para no filtrar el estado.
      throw this.invalidCredentials();
    }

    if (user.mustChangePassword) {
      // Modo forzado — no se valida currentPassword.
    } else {
      if (!dto.currentPassword) {
        throw new BadRequestException({
          code: 'CURRENT_PASSWORD_REQUIRED',
          message: 'currentPassword es requerida para cambiar la password.',
        });
      }
      const valid = await this.passwordService.verify(
        user.passwordHash,
        dto.currentPassword,
      );
      if (!valid) {
        throw this.invalidCredentials();
      }
    }

    const newHash = await this.passwordService.hash(dto.newPassword);
    await this.usersService.setPassword(user.id, newHash);
    await this.refreshTokenService.revokeAllForUser(user.id);
  }

  private async loginSuperadmin(
    dto: LoginDto,
    ctx: ClientContext,
  ): Promise<LoginResponse> {
    const user = await this.usersService.findSuperadminByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw this.invalidCredentials();
    }
    if (!user.isActive) {
      throw this.userInactive();
    }
    const valid = await this.passwordService.verify(
      user.passwordHash,
      dto.password,
    );
    if (!valid) {
      throw this.invalidCredentials();
    }
    return this.buildResponse(user, null, ctx);
  }

  private async loginTenantUser(
    slug: string,
    dto: LoginDto,
    ctx: ClientContext,
  ): Promise<LoginResponse> {
    const tenant = await this.tenantsService.findBySlugIncludingInactive(slug);
    if (!tenant) {
      // Slug no existe — 401 genérico (no se filtra existencia del tenant).
      throw this.invalidCredentials();
    }
    if (!tenant.isActive) {
      throw this.tenantInactive();
    }
    const user = await this.usersService.findByEmailAndTenant(
      tenant.id,
      dto.email,
    );
    if (!user || !user.passwordHash) {
      throw this.invalidCredentials();
    }
    if (!user.isActive) {
      throw this.userInactive();
    }
    const valid = await this.passwordService.verify(
      user.passwordHash,
      dto.password,
    );
    if (!valid) {
      throw this.invalidCredentials();
    }
    return this.buildResponse(user, tenant, ctx);
  }

  private async loginStudent(
    slug: string,
    dto: StudentLoginDto,
    ctx: ClientContext,
  ): Promise<LoginResponse> {
    const tenant = await this.tenantsService.findBySlugIncludingInactive(slug);
    if (!tenant) {
      throw this.invalidCredentials();
    }
    if (!tenant.isActive) {
      throw this.tenantInactive();
    }
    const student = await this.usersService.findStudentByDniAndTenant(
      tenant.id,
      dto.dni,
    );
    if (!student) {
      throw this.invalidCredentials();
    }
    if (!student.isActive) {
      throw this.userInactive();
    }
    return this.buildResponse(student, tenant, ctx);
  }

  private async buildResponse(
    user: User,
    tenant: Tenant | null,
    ctx: ClientContext,
  ): Promise<LoginResponse> {
    const accessToken = await this.signAccessToken(user, tenant);
    const refresh = await this.refreshTokenService.issue({
      userId: user.id,
      tenantId: user.isSuperadmin ? null : (tenant?.id ?? user.tenantId),
      userAgent: ctx.userAgent,
      ip: ctx.ip,
    });
    return this.assembleResponse(user, tenant, accessToken, refresh);
  }

  private async signAccessToken(
    user: User,
    tenant: Tenant | null,
  ): Promise<string> {
    const isSuperadmin = user.isSuperadmin;
    const payload: JwtAccessPayload = {
      sub: user.id,
      tenantId: isSuperadmin ? null : (tenant?.id ?? user.tenantId),
      role: isSuperadmin ? null : user.role,
      isSuperadmin,
    };
    return this.jwtService.signAsync(payload);
  }

  private assembleResponse(
    user: User,
    tenant: Tenant | null,
    accessToken: string,
    refresh: { token: string; expiresAt: Date },
  ): LoginResponse {
    const isSuperadmin = user.isSuperadmin;
    return {
      accessToken,
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt.toISOString(),
      user: {
        id: user.id,
        role: isSuperadmin ? null : user.role,
        isSuperadmin,
        mustChangePassword: user.mustChangePassword,
        firstName: user.firstName,
        lastName: user.lastName,
        tenant: tenant
          ? { id: tenant.id, slug: tenant.slug, name: tenant.name }
          : null,
      },
    };
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'Email o contraseña inválidos.',
    });
  }

  private tenantInactive(): ForbiddenException {
    return new ForbiddenException({
      code: 'TENANT_INACTIVE',
      message: 'Tu cuenta está pausada. Contactá a tu vendedor por WhatsApp.',
    });
  }

  private userInactive(): ForbiddenException {
    return new ForbiddenException({
      code: 'USER_INACTIVE',
      message: 'Tu cuenta está pausada, contactá a tu entrenador.',
    });
  }
}
