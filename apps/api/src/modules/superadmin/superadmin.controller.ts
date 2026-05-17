import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt-payload';
import { SuperadminGuard } from '../auth/superadmin.guard';

/**
 * Endpoint dummy del surface `/superadmin/*`. Existe para que Step 7 pueda
 * verificar el `SuperadminGuard` end-to-end (200 con JWT de SUPERADMIN,
 * 401 sin JWT, 403 con JWT no-superadmin). Step 13 lo reemplaza/extiende
 * con CRUD real de tenants.
 */
@Controller('superadmin')
@UseGuards(JwtAuthGuard, SuperadminGuard)
export class SuperadminController {
  @Get('ping')
  ping(@Req() req: Request): { ok: true; userId: string } {
    const user = req.user as AuthenticatedUser;
    return { ok: true, userId: user.userId };
  }
}
