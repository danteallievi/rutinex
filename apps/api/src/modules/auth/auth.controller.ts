import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthService, type ClientContext, LoginResponse } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { StudentLoginDto } from './dto/student-login.dto';
import { extractHostname } from './host';
import type { AuthenticatedUser } from './jwt-payload';
import { Public } from './public.decorator';
import {
  clearRefreshCookie,
  extractRefreshToken,
  setRefreshCookie,
} from './refresh-cookie';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginDto,
  ): Promise<LoginResponse> {
    const hostname = extractHostname(req.headers);
    const ctx = this.buildContext(req);
    const result = await this.authService.login(hostname, dto, ctx);
    setRefreshCookie(
      res,
      result.refreshToken,
      new Date(result.refreshTokenExpiresAt),
    );
    return result;
  }

  @Public()
  @Post('student-login')
  @HttpCode(HttpStatus.OK)
  async studentLogin(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: StudentLoginDto,
  ): Promise<LoginResponse> {
    const hostname = extractHostname(req.headers);
    const ctx = this.buildContext(req);
    const result = await this.authService.studentLogin(hostname, dto, ctx);
    setRefreshCookie(
      res,
      result.refreshToken,
      new Date(result.refreshTokenExpiresAt),
    );
    return result;
  }

  /**
   * Rota un refresh token. Lee el token del body o de la cookie httpOnly
   * `rutinex_refresh` (en ese orden). Devuelve un par nuevo y actualiza la
   * cookie.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RefreshDto,
  ): Promise<LoginResponse> {
    const token = extractRefreshToken(
      dto,
      req.cookies as Record<string, string | undefined> | undefined,
    );
    if (!token) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Refresh token inválido o expirado.',
      });
    }
    const ctx = this.buildContext(req);
    const result = await this.authService.refresh(token, ctx);
    setRefreshCookie(
      res,
      result.refreshToken,
      new Date(result.refreshTokenExpiresAt),
    );
    return result;
  }

  /**
   * Revoca el refresh token presentado. Requiere bearer (lo aplica el
   * `JwtAuthGuard` global) para evitar que cualquier anónimo dispare logout
   * masivos por probar tokens. Idempotente: si el token no existe o ya estaba
   * revocado, igual responde 204.
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RefreshDto,
  ): Promise<void> {
    const token = extractRefreshToken(
      dto,
      req.cookies as Record<string, string | undefined> | undefined,
    );
    if (token) {
      await this.authService.logout(token);
    }
    clearRefreshCookie(res);
  }

  /**
   * Revoca todos los refresh tokens activos del user autenticado. Bearer
   * requerido. Útil para "cerrar sesión en todos los dispositivos".
   */
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const user = req.user as AuthenticatedUser;
    await this.authService.logoutAll(user.userId);
    clearRefreshCookie(res);
  }

  /**
   * Cubre los dos modos:
   * - Forzado (`must_change_password=true`): body `{ newPassword }`.
   * - Voluntario: body `{ currentPassword, newPassword }`.
   *
   * Requiere JWT válido (lo provee el `JwtAuthGuard` global). El service
   * revoca todos los refresh del user, forzando re-login en otros devices.
   */
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    const user = req.user as AuthenticatedUser;
    await this.authService.changePassword(user.userId, dto);
    clearRefreshCookie(res);
  }

  private buildContext(req: Request): ClientContext {
    const userAgent = req.headers['user-agent'] ?? null;
    const ip = req.ip ?? null;
    return {
      userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 255) : null,
      ip,
    };
  }
}
