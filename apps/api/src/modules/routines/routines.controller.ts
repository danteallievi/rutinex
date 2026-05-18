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
import { Roles } from '../auth/roles.decorator';
import { TenantId } from '../auth/tenant-id.decorator';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { ListRoutinesQueryDto } from './dto/list-routines.query.dto';
import type {
  PaginatedRoutinesResponse,
  RoutineResponse,
} from './dto/routine.response';
import { UpdateRoutineDto } from './dto/update-routine.dto';
import { RoutinesService } from './routines.service';

/**
 * CRUD de routines del tenant (Step 16).
 *
 * Guard chain global (Jwt + Tenant + Roles). Lecturas (`GET /routines`,
 * `GET /routines/:id`) quedan sin `@Roles` — por ADR-019, abiertas a cualquier
 * user autenticado del tenant (incluido STUDENT, que necesita ver sus rutinas
 * asignadas en Step 17/18). Las escrituras restringen a OWNER/TRAINER.
 */
@Controller('routines')
export class RoutinesController {
  constructor(private readonly routinesService: RoutinesService) {}

  @Post()
  @Roles('OWNER', 'TRAINER')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateRoutineDto,
  ): Promise<RoutineResponse> {
    return this.routinesService.create(tenantId, actor.userId, dto);
  }

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query() query: ListRoutinesQueryDto,
  ): Promise<PaginatedRoutinesResponse> {
    return this.routinesService.list(tenantId, query);
  }

  @Get(':id')
  async findOne(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RoutineResponse> {
    return this.routinesService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Roles('OWNER', 'TRAINER')
  async update(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoutineDto,
  ): Promise<RoutineResponse> {
    return this.routinesService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('OWNER', 'TRAINER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.routinesService.remove(tenantId, id);
  }
}
