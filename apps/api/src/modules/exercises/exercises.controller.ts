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
import { CreateExerciseDto } from './dto/create-exercise.dto';
import type {
  ExerciseResponse,
  PaginatedExercisesResponse,
} from './dto/exercise.response';
import { ListExercisesQueryDto } from './dto/list-exercises.query.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';
import { ExercisesService } from './exercises.service';

/**
 * CRUD del catálogo de exercises del tenant (Step 14).
 *
 * Guard chain global (Jwt + Tenant + Roles). Las lecturas (`GET /exercises`,
 * `GET /exercises/:id`) quedan sin `@Roles` — por ADR-019, eso deja el
 * endpoint abierto a cualquier user autenticado del tenant (incluido
 * STUDENT). Las escrituras restringen a OWNER/TRAINER.
 */
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Post()
  @Roles('OWNER', 'TRAINER')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateExerciseDto,
  ): Promise<ExerciseResponse> {
    return this.exercisesService.create(tenantId, actor.userId, dto);
  }

  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query() query: ListExercisesQueryDto,
  ): Promise<PaginatedExercisesResponse> {
    return this.exercisesService.list(tenantId, query);
  }

  @Get(':id')
  async findOne(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ExerciseResponse> {
    return this.exercisesService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Roles('OWNER', 'TRAINER')
  async update(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateExerciseDto,
  ): Promise<ExerciseResponse> {
    return this.exercisesService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('OWNER', 'TRAINER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.exercisesService.remove(tenantId, id);
  }
}
