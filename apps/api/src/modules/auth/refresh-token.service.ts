import { createHash, randomBytes } from 'node:crypto';

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { RefreshToken } from './entities/refresh-token.entity';
import {
  REFRESH_TOKEN_BYTES,
  REFRESH_TOKEN_TTL_MS,
} from './refresh-token.constants';

interface IssueInput {
  userId: string;
  tenantId: string | null;
  userAgent: string | null;
  ip: string | null;
}

interface IssueResult {
  token: string;
  expiresAt: Date;
}

interface RotateInput {
  presentedToken: string;
  userAgent: string | null;
  ip: string | null;
}

interface RotateResult {
  token: string;
  expiresAt: Date;
  userId: string;
  tenantId: string | null;
}

/**
 * Gestor de refresh tokens. El token plano nunca se persiste — sólo su hash
 * SHA-256 (hex de 64 chars) — y nunca se loggea. La rotación con detección
 * de reuso vive acá; el `AuthService` orquesta el flow (validar tenant/user,
 * emitir access JWT).
 *
 * Fuente de verdad de la política: `docs/04-auth.md` → "Refresh token" +
 * "Detección de reuso".
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly repo: Repository<RefreshToken>,
  ) {}

  /**
   * Emite un refresh token nuevo para `userId`. Devuelve el token en plano
   * (única vez que existe fuera del cliente) y la expiración.
   */
  async issue(input: IssueInput): Promise<IssueResult> {
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.repo.save(
      this.repo.create({
        userId: input.userId,
        tenantId: input.tenantId,
        tokenHash,
        expiresAt,
        revokedAt: null,
        replacedBy: null,
        userAgent: input.userAgent,
        ip: input.ip,
      }),
    );

    return { token, expiresAt };
  }

  /**
   * Rotación con detección de reuso:
   *
   * - Si el token no existe, está expirado o no matchea por hash → 401 genérico.
   * - Si el token **ya estaba revocado** → es señal de robo: revocamos todos
   *   los refresh tokens activos del user y devolvemos 401. Loggeado como
   *   incidente.
   * - Si el token está OK → marcamos `revoked_at`, creamos uno nuevo y
   *   apuntamos `replaced_by` al nuevo. Devolvemos el par nuevo + el contexto
   *   (userId, tenantId) para que el caller arme el access JWT.
   */
  async rotate(input: RotateInput): Promise<RotateResult> {
    const tokenHash = this.hashToken(input.presentedToken);
    const existing = await this.repo.findOne({ where: { tokenHash } });

    if (!existing) {
      throw this.invalidRefresh();
    }

    if (existing.revokedAt) {
      // Reuse detection: alguien ya consumió este refresh y ahora vuelve a
      // venir. Asumimos robo y matamos toda la sesión del user.
      await this.revokeAllForUser(existing.userId);
      this.logger.warn(
        `Refresh token reuse detectado para user=${existing.userId} (token id=${existing.id}). Se revocaron todos los refresh activos del user.`,
      );
      throw this.invalidRefresh();
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw this.invalidRefresh();
    }

    const newToken = this.generateToken();
    const newHash = this.hashToken(newToken);
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    const replacement = await this.repo.save(
      this.repo.create({
        userId: existing.userId,
        tenantId: existing.tenantId,
        tokenHash: newHash,
        expiresAt: newExpiresAt,
        revokedAt: null,
        replacedBy: null,
        userAgent: input.userAgent,
        ip: input.ip,
      }),
    );

    await this.repo.update(
      { id: existing.id },
      { revokedAt: new Date(), replacedBy: replacement.id },
    );

    return {
      token: newToken,
      expiresAt: newExpiresAt,
      userId: existing.userId,
      tenantId: existing.tenantId,
    };
  }

  /**
   * Revoca un refresh token presentado. No-op si no existe o ya está
   * revocado — no se filtra existencia. Devuelve `true` si efectivamente
   * marcó una fila como revocada.
   */
  async revoke(presentedToken: string): Promise<boolean> {
    const tokenHash = this.hashToken(presentedToken);
    const result = await this.repo.update(
      { tokenHash, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Revoca todos los refresh tokens activos del user. Lo usan:
   * - `change-password` (forzado y voluntario): forzar re-login en otros
   *   devices.
   * - `logout-all`: cerrar la sesión en todos los devices del user.
   * - Detección de reuso: matar la sesión cuando se ve un refresh revocado.
   */
  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.repo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return result.affected ?? 0;
  }

  /**
   * Revoca todos los refresh tokens activos del tenant. Lo usa el panel
   * SUPERADMIN cuando desactiva un tenant (`is_active: true → false`) para
   * que las sesiones vivas dejen de poder refrescar sin esperar 15min al
   * vencimiento del access JWT.
   */
  async revokeAllForTenant(tenantId: string): Promise<number> {
    const result = await this.repo.update(
      { tenantId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return result.affected ?? 0;
  }

  private generateToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private invalidRefresh(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'Refresh token inválido o expirado.',
    });
  }
}
