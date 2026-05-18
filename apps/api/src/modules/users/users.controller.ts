import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-payload';
import { RefreshTokenService } from '../auth/refresh-token.service';
import { Roles } from '../auth/roles.decorator';
import { TenantId } from '../auth/tenant-id.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  type CreateUserResponse,
  type PaginatedUsersResponse,
  type ResetPasswordResponse,
  type UserResponse,
} from './dto/user.response';
import { UsersService } from './users.service';

/**
 * CRUD de users del tenant (Step 12). Todas las rutas son tenant-scoped:
 * - JwtAuthGuard popula `req.user`.
 * - TenantGuard valida `x-tenant-slug` contra `req.user.tenantId`.
 * - RolesGuard a nivel clase exige OWNER o TRAINER; los handlers que sólo
 *   permiten OWNER (reset-password, delete) lo restringen con `@Roles('OWNER')`
 *   (handler-level gana sobre class-level — ver `RolesGuard`).
 *
 * La validación de jerarquía OWNER↔TRAINER↔STUDENT que no cabe en los
 * guards vive en el `UsersService` y se expresa como 403
 * `FORBIDDEN_ROLE_HIERARCHY` (ADR-020).
 */
@Controller('users')
@Roles('OWNER', 'TRAINER')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateUserDto,
  ): Promise<CreateUserResponse> {
    return this.usersService.createByActor(tenantId, actor, dto);
  }

  @Get()
  async list(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedUsersResponse> {
    return this.usersService.listForActor(tenantId, actor, query);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponse> {
    const { response, deactivated } = await this.usersService.updateForActor(
      tenantId,
      actor,
      id,
      dto,
    );
    if (deactivated) {
      // Soft-pause: matar las sesiones abiertas del user pausado para que
      // su access token vivo (≤15min) deje de poder renovarse.
      await this.refreshTokenService.revokeAllForUser(id);
    }
    return response;
  }

  @Delete(':id')
  @Roles('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.usersService.removeForActor(tenantId, actor, id);
    await this.refreshTokenService.revokeAllForUser(id);
  }

  @Post(':id/reset-password')
  @Roles('OWNER')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ResetPasswordResponse> {
    const result = await this.usersService.resetTrainerPassword(tenantId, id);
    // Revocar todas las sesiones del TRAINER reseteado — al recibir la
    // password nueva por WhatsApp, hace login de cero (must_change_password=true).
    await this.refreshTokenService.revokeAllForUser(id);
    return result;
  }
}
