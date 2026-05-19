import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';

import type { AuthenticatedUser } from '../auth/jwt-payload';
import { Routine } from '../routines/entities/routine.entity';
import { User } from '../users/entities/user.entity';
import { AssignmentsRepository } from './assignments.repository';
import type { CreateAssignmentDto } from './dto/create-assignment.dto';
import type { ListAssignmentsQueryDto } from './dto/list-assignments.query.dto';
import type { AssignmentResponse } from './dto/assignment.response';
import {
  toAssignmentResponse,
  todayDateString,
} from './dto/assignment.response';
import { Assignment } from './entities/assignment.entity';

/**
 * Asignación de rutinas a STUDENTS (Step 17).
 *
 * Estado del assignment es inmutable: no hay PATCH. Para cambiar fechas o
 * weekdayMask, el caller borra la asignación y crea una nueva (alineado con
 * la simplicidad del MVP y con el roadmap, que sólo pide POST/GET/DELETE).
 *
 * Jerarquía (ADR-025):
 * - POST: OWNER asigna a cualquier STUDENT del tenant; TRAINER sólo a
 *   `student.trainerId === actor.userId`; STUDENT cortado por @Roles antes.
 * - GET: OWNER ve cualquier STUDENT; TRAINER sólo sus STUDENTs; STUDENT sólo
 *   self.
 * - DELETE: OWNER cualquiera; TRAINER sólo si `student.trainerId === actor.userId`.
 */
@Injectable()
export class AssignmentsService {
  constructor(
    private readonly assignmentsRepository: AssignmentsRepository,
    private readonly dataSource: DataSource,
  ) {}

  async createForRoutine(
    tenantId: string,
    actor: AuthenticatedUser,
    routineId: string,
    dto: CreateAssignmentDto,
  ): Promise<AssignmentResponse> {
    this.assertDateRange(dto.startsOn, dto.endsOn ?? null);

    const routine = await this.dataSource.getRepository(Routine).findOne({
      where: { tenantId, id: routineId },
    });
    if (!routine) {
      throw new NotFoundException({
        code: 'ROUTINE_NOT_FOUND',
        message: `Routine "${routineId}" no encontrada.`,
      });
    }

    const student = await this.dataSource.getRepository(User).findOne({
      where: { tenantId, id: dto.studentId },
    });
    if (!student) {
      throw this.studentNotFound(dto.studentId);
    }
    if (student.role !== 'STUDENT') {
      throw new BadRequestException({
        code: 'ASSIGNMENT_INVALID_STUDENT',
        message: 'El user destino existe pero no tiene role=STUDENT.',
      });
    }

    this.assertActorCanTouchStudent(actor, student);

    const created = await this.assignmentsRepository.save(
      this.assignmentsRepository.create({
        tenantId,
        routineId: routine.id,
        studentId: student.id,
        assignedBy: actor.userId,
        startsOn: dto.startsOn,
        endsOn: dto.endsOn ?? null,
        weekdayMask: dto.weekdayMask,
      }),
    );
    return toAssignmentResponse(created);
  }

  async listForStudent(
    tenantId: string,
    actor: AuthenticatedUser,
    studentId: string,
    query: ListAssignmentsQueryDto,
  ): Promise<AssignmentResponse[]> {
    const student = await this.dataSource.getRepository(User).findOne({
      where: { tenantId, id: studentId },
    });
    if (!student || student.role !== 'STUDENT') {
      throw this.studentNotFound(studentId);
    }

    this.assertActorCanReadStudent(actor, student);

    const where: FindOptionsWhere<Assignment> = { tenantId, studentId };
    const rows = await this.assignmentsRepository.find({
      where,
      order: { startsOn: 'DESC', createdAt: 'DESC' },
    });

    const today = todayDateString();
    const all = rows.map((r) => toAssignmentResponse(r, today));
    if (query.status === undefined || query.status === 'all') return all;
    return all.filter((a) => a.status === query.status);
  }

  async removeByActor(
    tenantId: string,
    actor: AuthenticatedUser,
    id: string,
  ): Promise<void> {
    const assignment = await this.assignmentsRepository.findOne({
      where: { tenantId, id },
    });
    if (!assignment) {
      throw this.assignmentNotFound(id);
    }

    // El TRAINER sólo puede borrar asignaciones de sus propios STUDENTs.
    if (actor.role === 'TRAINER') {
      const student = await this.dataSource.getRepository(User).findOne({
        where: { tenantId, id: assignment.studentId },
      });
      if (!student || student.trainerId !== actor.userId) {
        throw this.forbiddenHierarchy(
          'Sólo podés borrar asignaciones de tus propios alumnos.',
        );
      }
    }

    await this.assignmentsRepository.delete({ tenantId, id });
  }

  // ---------------------------------------------------------------------------
  // Validaciones de jerarquía
  // ---------------------------------------------------------------------------

  private assertActorCanTouchStudent(
    actor: AuthenticatedUser,
    student: User,
  ): void {
    if (actor.role === 'OWNER') return;
    if (actor.role === 'TRAINER' && student.trainerId === actor.userId) return;
    throw this.forbiddenHierarchy(
      'Sólo podés asignar rutinas a tus propios alumnos.',
    );
  }

  private assertActorCanReadStudent(
    actor: AuthenticatedUser,
    student: User,
  ): void {
    if (actor.role === 'OWNER') return;
    if (actor.role === 'TRAINER' && student.trainerId === actor.userId) return;
    if (actor.role === 'STUDENT' && actor.userId === student.id) return;
    throw this.forbiddenHierarchy('No podés leer asignaciones de este alumno.');
  }

  private assertDateRange(startsOn: string, endsOn: string | null): void {
    if (endsOn !== null && endsOn < startsOn) {
      throw new BadRequestException({
        code: 'ASSIGNMENT_INVALID_DATE_RANGE',
        message: 'endsOn debe ser >= startsOn.',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Errors
  // ---------------------------------------------------------------------------

  private studentNotFound(id: string): NotFoundException {
    return new NotFoundException({
      code: 'STUDENT_NOT_FOUND',
      message: `Student "${id}" no encontrado.`,
    });
  }

  private assignmentNotFound(id: string): NotFoundException {
    return new NotFoundException({
      code: 'ASSIGNMENT_NOT_FOUND',
      message: `Assignment "${id}" no encontrada.`,
    });
  }

  private forbiddenHierarchy(message: string): ForbiddenException {
    return new ForbiddenException({
      code: 'FORBIDDEN_ROLE_HIERARCHY',
      message,
    });
  }
}
