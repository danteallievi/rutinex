import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { SuperadminGuard } from '../auth/superadmin.guard';
import { CreateSuperadminTenantDto } from './dto/create-superadmin-tenant.dto';
import { ListSuperadminTenantsQueryDto } from './dto/list-superadmin-tenants.query.dto';
import { ResetOwnerPasswordQueryDto } from './dto/reset-owner-password.query.dto';
import type {
  CreateSuperadminTenantResponse,
  PaginatedSuperadminTenantsResponse,
  ResetOwnerPasswordResponse,
  SuperadminTenantResponse,
} from './dto/superadmin-tenant.response';
import { UpdateSuperadminTenantDto } from './dto/update-superadmin-tenant.dto';
import { SuperadminTenantsService } from './superadmin-tenants.service';

/**
 * CRUD de tenants para el panel SUPERADMIN (Step 13). El `JwtAuthGuard`
 * global popula `req.user`; el `SuperadminGuard` de clase exige que
 * `req.user.isSuperadmin === true` (403 `NOT_SUPERADMIN` si no).
 *
 * Las rutas NO pasan por `TenantGuard` — el path `/superadmin/*` está en
 * la lista de skips del guard (ver `TenantGuard`).
 */
@Controller('superadmin/tenants')
@UseGuards(SuperadminGuard)
export class SuperadminTenantsController {
  constructor(private readonly service: SuperadminTenantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateSuperadminTenantDto,
  ): Promise<CreateSuperadminTenantResponse> {
    return this.service.create(dto);
  }

  @Get()
  list(
    @Query() query: ListSuperadminTenantsQueryDto,
  ): Promise<PaginatedSuperadminTenantsResponse> {
    return this.service.list(query);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSuperadminTenantDto,
  ): Promise<SuperadminTenantResponse> {
    return this.service.update(id, dto);
  }

  @Post(':id/reset-owner-password')
  @HttpCode(HttpStatus.OK)
  resetOwnerPassword(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ResetOwnerPasswordQueryDto,
  ): Promise<ResetOwnerPasswordResponse> {
    return this.service.resetOwnerPassword(id, query.ownerId);
  }
}
