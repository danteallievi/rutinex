import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt-payload';
import { TenantId } from '../auth/tenant-id.decorator';
import type { PersonalRecordResponse } from './dto/personal-record.response';
import { PersonalRecordsService } from './personal-records.service';

/**
 * Endpoints de PRs (Step 19 / ADR-027). Las dos rutas viven bajo
 * `/students/:studentId/...` — `@Controller()` sin prefix para alinear con
 * AssignmentsController (path completo por handler).
 *
 * Sin `@Roles` (jerarquía OWNER/TRAINER/STUDENT vive en el service).
 */
@Controller()
export class PersonalRecordsController {
  constructor(
    private readonly personalRecordsService: PersonalRecordsService,
  ) {}

  @Get('students/:studentId/personal-records')
  async listByStudent(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
  ): Promise<PersonalRecordResponse[]> {
    return this.personalRecordsService.listByStudent(
      tenantId,
      actor,
      studentId,
    );
  }

  @Get('students/:studentId/personal-records/:exerciseId')
  async listByStudentAndExercise(
    @TenantId() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
    @Param('exerciseId', new ParseUUIDPipe()) exerciseId: string,
  ): Promise<PersonalRecordResponse[]> {
    return this.personalRecordsService.listByStudentAndExercise(
      tenantId,
      actor,
      studentId,
      exerciseId,
    );
  }
}
