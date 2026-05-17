import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthService, LoginResponse } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { StudentLoginDto } from './dto/student-login.dto';
import { extractHostname } from './host';
import type { AuthenticatedUser } from './jwt-payload';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Req() req: Request, @Body() dto: LoginDto): Promise<LoginResponse> {
    const hostname = extractHostname(req.headers);
    return this.authService.login(hostname, dto);
  }

  @Public()
  @Post('student-login')
  @HttpCode(HttpStatus.OK)
  studentLogin(
    @Req() req: Request,
    @Body() dto: StudentLoginDto,
  ): Promise<LoginResponse> {
    const hostname = extractHostname(req.headers);
    return this.authService.studentLogin(hostname, dto);
  }

  /**
   * Cubre los dos modos:
   * - Forzado (`must_change_password=true`): body `{ newPassword }`.
   * - Voluntario: body `{ currentPassword, newPassword }`.
   *
   * Requiere JWT válido (lo provee el `JwtAuthGuard` global).
   */
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    const user = req.user as AuthenticatedUser;
    await this.authService.changePassword(user.userId, dto);
  }
}
