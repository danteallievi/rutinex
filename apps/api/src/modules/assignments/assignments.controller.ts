import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-payload';
import { Roles } from '../auth/roles.decorator';
import { TenantId } from '../auth/tenant-id.decorator';
import { AssignmentsService } from './assignments.service';
import type { AssignmentResponse } from './dto/assignment.response';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { ListAssignmentsQueryDto } from './dto/list-assignments.query.dto';

/**
 * Endpoints de asignaciones (Step 17). Tres rutas con paths distintos —
 * `@Controller()` sin prefix para que cada handler declare su path completo
 * (`/routines/:id/assignments`, `/students/:id/assignments`, `/assignments/:id`).
 *
 * Guard chain global (Jwt + Tenant + Roles). El @Roles aplica per-handler:
 * GET queda sin @Roles (STUDENT lee sus propias asignaciones, gate fino vive
 * en el service por jerarquía).
 */
@Controller()
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post('routines/:id/assignments')
  @Roles('OWNER', 'TRAINER')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) routineId: string,
    @Body() dto: CreateAssignmentDto,
  ): Promise<AssignmentResponse> {
    return this.assignmentsService.createForRoutine(
      tenantId,
      actor,
      routineId,
      dto,
    );
  }

  @Get('students/:id/assignments')
  async listForStudent(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) studentId: string,
    @Query() query: ListAssignmentsQueryDto,
  ): Promise<AssignmentResponse[]> {
    return this.assignmentsService.listForStudent(
      tenantId,
      actor,
      studentId,
      query,
    );
  }

  @Delete('assignments/:id')
  @Roles('OWNER', 'TRAINER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.assignmentsService.removeByActor(tenantId, actor, id);
  }
}
