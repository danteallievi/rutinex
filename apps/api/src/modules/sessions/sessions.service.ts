import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, IsNull, QueryFailedError } from 'typeorm';

import type { AuthenticatedUser } from '../auth/jwt-payload';
import { Assignment } from '../assignments/entities/assignment.entity';
import {
  computeAssignmentStatus,
  todayDateString,
} from '../assignments/dto/assignment.response';
import { Exercise } from '../exercises/entities/exercise.entity';
import { toRoutineResponse } from '../routines/dto/routine.response';
import { RoutineItem } from '../routines/entities/routine-item.entity';
import { Routine } from '../routines/entities/routine.entity';
import { User } from '../users/entities/user.entity';
import type { AddSetDto } from './dto/add-set.dto';
import type { CreateSessionDto } from './dto/create-session.dto';
import { decodeCursor, encodeCursor } from './dto/cursor';
import type { ListSessionsQueryDto } from './dto/list-sessions.query.dto';
import type { SessionRoutineSnapshot } from './dto/session-snapshot';
import type {
  CursorPaginatedSessionsResponse,
  SessionResponse,
  TodaySessionResponse,
} from './dto/session.response';
import {
  toSessionListItemResponse,
  toSessionResponse,
} from './dto/session.response';
import { Session } from './entities/session.entity';
import { WorkoutSet } from './entities/set.entity';
import { SessionsRepository } from './sessions.repository';

/**
 * Ejecución de rutinas (Step 18 / ADR-026).
 *
 * Decisiones clave:
 * - `routine_snapshot` jsonb se congela en `create()` con el shape de
 *   `RoutineResponse` del Step 16. La sesión opera contra el snapshot, no
 *   contra la rutina viva (ADR-026 §3).
 * - 1 sesión abierta por `(assignment_id)` (UNIQUE parcial donde
 *   `completed_at IS NULL`). El service rechaza con 409 `SESSION_ALREADY_OPEN`
 *   antes de tocar el constraint para dar un `code` parseable.
 * - Sesión completada es inmutable: no más `addSet` ni re-complete.
 * - `weekdayMask` NO se valida en `create()` (ADR-026 §5): el STUDENT puede
 *   "hacer hoy lo de ayer" mientras el assignment esté en rango.
 * - Jerarquía: `POST /sessions`, `POST /:id/sets`, `POST /:id/complete` van
 *   con `@Roles('STUDENT')` y el service verifica que `assignment.studentId
 *   === actor.userId`. `GET /sessions` aplica jerarquía OWNER/TRAINER/STUDENT
 *   en service.
 */
@Injectable()
export class SessionsService {
  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /sessions
  // ---------------------------------------------------------------------------
  async create(
    tenantId: string,
    actor: AuthenticatedUser,
    dto: CreateSessionDto,
  ): Promise<SessionResponse> {
    return this.dataSource.transaction(async (manager) => {
      const assignment = await manager.getRepository(Assignment).findOne({
        where: { tenantId, id: dto.assignmentId },
      });
      if (!assignment) {
        throw this.assignmentNotFound(dto.assignmentId);
      }
      if (assignment.studentId !== actor.userId) {
        throw this.forbiddenHierarchy(
          'Sólo podés arrancar sesiones sobre tus propias asignaciones.',
        );
      }

      // Assignment debe estar `active` (no future / not expired). Si en el
      // borde la asignación recién arranca hoy o termina hoy, sigue active.
      const today = todayDateString();
      const status = computeAssignmentStatus(
        assignment.startsOn,
        assignment.endsOn,
        today,
      );
      if (status !== 'active') {
        throw new BadRequestException({
          code: 'ASSIGNMENT_NOT_ACTIVE',
          message: `La asignación está ${status} (no se puede arrancar una sesión).`,
        });
      }

      // 1 sesión abierta por assignment. Si ya hay otra abierta, 409 —
      // el cliente debe completarla antes (o usar el openSessionId que devuelve
      // GET /sessions/today para reanudar).
      const open = await manager.getRepository(Session).findOne({
        where: { tenantId, assignmentId: assignment.id, completedAt: IsNull() },
      });
      if (open) {
        throw new ConflictException({
          code: 'SESSION_ALREADY_OPEN',
          message:
            'Ya hay una sesión en curso para esta asignación. Completala o reanudala.',
        });
      }

      const snapshot = await this.buildRoutineSnapshot(
        manager,
        tenantId,
        assignment.routineId,
      );

      const sessionRepo = manager.getRepository(Session);
      const session = await sessionRepo.save(
        sessionRepo.create({
          tenantId,
          assignmentId: assignment.id,
          routineId: assignment.routineId,
          studentId: assignment.studentId,
          routineSnapshot: snapshot,
          completedAt: null,
        }),
      );

      // Releer para tener `startedAt` resuelto por @CreateDateColumn.
      const refreshed = await sessionRepo.findOne({
        where: { tenantId, id: session.id },
      });
      return toSessionResponse(refreshed ?? session, []);
    });
  }

  // ---------------------------------------------------------------------------
  // GET /sessions/today
  // ---------------------------------------------------------------------------
  async getToday(
    tenantId: string,
    actor: AuthenticatedUser,
  ): Promise<TodaySessionResponse | null> {
    if (actor.role !== 'STUDENT') {
      // El roadmap deja este endpoint sólo para STUDENT. Otros roles que lleguen
      // (sin @Roles bloqueándolos) reciben null — no exponemos un `today` para
      // OWNER/TRAINER que pueda ser ambiguo.
      return null;
    }

    const today = todayDateString();
    // bit `0` = Domingo, ... bit `6` = Sábado — alineado con `Date.getUTCDay()`.
    const dayOfWeek = new Date().getUTCDay();
    const dayBit = 1 << dayOfWeek;

    // Buscar la asignación active del student cuyo weekdayMask incluya hoy.
    // Si hay más de una, devolver la más reciente por `created_at DESC`.
    const assignment = await this.dataSource
      .getRepository(Assignment)
      .createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.student_id = :studentId', { studentId: actor.userId })
      .andWhere('a.starts_on <= :today', { today })
      .andWhere('(a.ends_on IS NULL OR a.ends_on >= :today)', { today })
      .andWhere('(a.weekday_mask & :dayBit) > 0', { dayBit })
      .orderBy('a.created_at', 'DESC')
      .getOne();
    if (!assignment) {
      return null;
    }

    // Snapshot "vivo" — preview de cómo se vería el routine_snapshot si el
    // student arranca ahora. Si ya hay sesión abierta para esta asignación, el
    // openSessionId apunta al recurso para reanudar.
    const liveSnapshot = await this.buildRoutineSnapshot(
      this.dataSource.manager,
      tenantId,
      assignment.routineId,
    );
    const open = await this.sessionsRepository.findOne({
      where: { tenantId, assignmentId: assignment.id, completedAt: IsNull() },
    });

    return {
      assignmentId: assignment.id,
      routineId: assignment.routineId,
      routine: liveSnapshot,
      openSessionId: open?.id ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // POST /sessions/:id/sets
  // ---------------------------------------------------------------------------
  async addSet(
    tenantId: string,
    actor: AuthenticatedUser,
    sessionId: string,
    dto: AddSetDto,
  ): Promise<SessionResponse> {
    return this.dataSource.transaction(async (manager) => {
      const session = await manager.getRepository(Session).findOne({
        where: { tenantId, id: sessionId },
      });
      if (!session) {
        throw this.sessionNotFound(sessionId);
      }
      if (session.studentId !== actor.userId) {
        throw this.forbiddenHierarchy(
          'Sólo podés cargar sets en tus propias sesiones.',
        );
      }
      if (session.completedAt !== null) {
        throw new BadRequestException({
          code: 'SESSION_ALREADY_COMPLETED',
          message: 'La sesión ya fue completada y no se puede modificar.',
        });
      }

      // Validar `routineItemId` contra el snapshot (no la tabla viva — el
      // PATCH del routine pudo cambiar los ids de routine_items, ADR-024 §3).
      const snapshotItem = session.routineSnapshot.items.find(
        (it) => it.id === dto.routineItemId,
      );
      if (!snapshotItem) {
        throw new BadRequestException({
          code: 'SET_INVALID_ROUTINE_ITEM',
          message: `routineItemId "${dto.routineItemId}" no pertenece al snapshot de esta sesión.`,
        });
      }

      // Unicidad por (session_id, routine_item_id, set_number) — antes del
      // INSERT para devolver un `code` parseable (no hay UNIQUE en DB porque
      // `routine_item_id` puede ser NULL; ver migración).
      const duplicate = await manager.getRepository(WorkoutSet).findOne({
        where: {
          tenantId,
          sessionId: session.id,
          routineItemId: dto.routineItemId,
          setNumber: dto.setNumber,
        },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'SET_NUMBER_DUPLICATED',
          message: `Ya existe un set con número ${String(dto.setNumber)} para este routine_item en esta sesión.`,
        });
      }

      const setsRepo = manager.getRepository(WorkoutSet);
      await setsRepo.save(
        setsRepo.create({
          tenantId,
          sessionId: session.id,
          routineItemId: dto.routineItemId,
          exerciseId: snapshotItem.exerciseId,
          studentId: session.studentId,
          setNumber: dto.setNumber,
          reps: dto.reps,
          // numeric mapea a string en TypeORM — pasamos el number tal cual,
          // pg lo serializa a numeric sin perder precisión hasta los 2 decimales
          // permitidos por el DTO.
          weightKg:
            dto.weightKg === undefined || dto.weightKg === null
              ? null
              : dto.weightKg.toFixed(2),
        }),
      );

      const allSets = await setsRepo.find({
        where: { tenantId, sessionId: session.id },
      });
      return toSessionResponse(session, allSets);
    });
  }

  // ---------------------------------------------------------------------------
  // POST /sessions/:id/complete
  // ---------------------------------------------------------------------------
  async complete(
    tenantId: string,
    actor: AuthenticatedUser,
    sessionId: string,
  ): Promise<SessionResponse> {
    return this.dataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(Session);
      const session = await sessionRepo.findOne({
        where: { tenantId, id: sessionId },
      });
      if (!session) {
        throw this.sessionNotFound(sessionId);
      }
      if (session.studentId !== actor.userId) {
        throw this.forbiddenHierarchy(
          'Sólo podés completar tus propias sesiones.',
        );
      }
      if (session.completedAt !== null) {
        throw new BadRequestException({
          code: 'SESSION_ALREADY_COMPLETED',
          message: 'La sesión ya fue completada.',
        });
      }

      const completedAt = new Date();
      await sessionRepo.update({ id: session.id }, { completedAt });
      session.completedAt = completedAt;

      const sets = await manager
        .getRepository(WorkoutSet)
        .find({ where: { tenantId, sessionId: session.id } });
      return toSessionResponse(session, sets);
    });
  }

  // ---------------------------------------------------------------------------
  // GET /sessions
  // ---------------------------------------------------------------------------
  async list(
    tenantId: string,
    actor: AuthenticatedUser,
    query: ListSessionsQueryDto,
  ): Promise<CursorPaginatedSessionsResponse> {
    const limit = query.limit ?? 20;

    // Jerarquía de lectura.
    let effectiveStudentId: string | undefined;
    if (actor.role === 'STUDENT') {
      // Forzar `studentId === actor.userId`. Si pide otro → 403.
      if (query.studentId !== undefined && query.studentId !== actor.userId) {
        throw this.forbiddenHierarchy('Sólo podés leer tus propias sesiones.');
      }
      effectiveStudentId = actor.userId;
    } else if (actor.role === 'TRAINER') {
      if (query.studentId !== undefined) {
        // El TRAINER pidió un student específico → debe ser propio.
        const student = await this.dataSource.getRepository(User).findOne({
          where: { tenantId, id: query.studentId },
        });
        if (
          !student ||
          student.role !== 'STUDENT' ||
          student.trainerId !== actor.userId
        ) {
          throw this.forbiddenHierarchy(
            'Sólo podés leer sesiones de tus propios alumnos.',
          );
        }
        effectiveStudentId = student.id;
      }
      // Sin studentId → restringimos a sesiones de students propios.
    } else if (actor.role === 'OWNER') {
      if (query.studentId !== undefined) {
        effectiveStudentId = query.studentId;
      }
    }

    const qb = this.sessionsRepository
      .createQueryBuilder('session')
      .where('session.tenant_id = :tenantId', { tenantId });

    if (effectiveStudentId !== undefined) {
      qb.andWhere('session.student_id = :studentId', {
        studentId: effectiveStudentId,
      });
    } else if (actor.role === 'TRAINER') {
      // TRAINER sin studentId: subquery por sus students.
      qb.andWhere(
        'session.student_id IN (SELECT u.id FROM users u WHERE u.tenant_id = :tenantId AND u.trainer_id = :trainerId)',
        { tenantId, trainerId: actor.userId },
      );
    }

    if (query.from !== undefined) {
      // `from` inclusivo desde 00:00:00Z.
      qb.andWhere('session.started_at >= :from', {
        from: `${query.from}T00:00:00.000Z`,
      });
    }
    if (query.to !== undefined) {
      // `to` inclusivo: incluye el día completo de `to` (exclusive del día
      // siguiente). Más natural para `?to=2026-05-20` (incluye el 20).
      const toDate = new Date(`${query.to}T00:00:00.000Z`);
      const nextDay = new Date(toDate.getTime() + 24 * 60 * 60 * 1000);
      qb.andWhere('session.started_at < :toExclusive', {
        toExclusive: nextDay.toISOString(),
      });
    }

    if (query.cursor !== undefined && query.cursor.length > 0) {
      const decoded = decodeCursor(query.cursor);
      if (decoded !== null) {
        // Orden (started_at DESC, id DESC) — el cursor representa el último
        // par visto, traemos los `<` para seguir desde ahí.
        qb.andWhere(
          '(session.started_at, session.id) < (:cursorStartedAt, :cursorId)',
          { cursorStartedAt: decoded.startedAt, cursorId: decoded.id },
        );
      }
    }

    const rows = await qb
      .orderBy('session.started_at', 'DESC')
      .addOrderBy('session.id', 'DESC')
      .take(limit + 1)
      .getMany();

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const last = pageRows[pageRows.length - 1];
    const nextCursor =
      hasMore && last !== undefined
        ? encodeCursor({ startedAt: last.startedAt.toISOString(), id: last.id })
        : null;

    return {
      data: pageRows.map(toSessionListItemResponse),
      nextCursor,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Snapshot de la rutina al momento de la sesión. Misma shape que
   * `RoutineResponse` (Step 16, ADR-026 §3): incluye los items con position,
   * datos prescritos y el exercise resuelto inline.
   *
   * `manager`: typed loose como `{ getRepository }` para que el llamador pase
   * `dataSource.manager` o el `manager` de una transacción indistintamente.
   */
  private async buildRoutineSnapshot(
    manager: {
      getRepository: DataSource['getRepository'];
    },
    tenantId: string,
    routineId: string,
  ): Promise<SessionRoutineSnapshot> {
    const routine = await manager.getRepository(Routine).findOne({
      where: { tenantId, id: routineId },
    });
    if (!routine) {
      // No debería llegar acá si el caller ya validó el assignment (cuya FK
      // RESTRICT garantiza routine vivo). Defensa en profundidad.
      throw new NotFoundException({
        code: 'ROUTINE_NOT_FOUND',
        message: `Routine "${routineId}" no encontrada.`,
      });
    }
    const items = await manager.getRepository(RoutineItem).find({
      where: { tenantId, routineId: routine.id },
    });
    const exerciseIds = Array.from(new Set(items.map((i) => i.exerciseId)));
    const exercises =
      exerciseIds.length === 0
        ? []
        : await manager
            .getRepository(Exercise)
            .find({ where: { tenantId, id: In(exerciseIds) } });
    const exercisesById = new Map(exercises.map((e) => [e.id, e]));
    return toRoutineResponse(routine, items, exercisesById);
  }

  private sessionNotFound(id: string): NotFoundException {
    return new NotFoundException({
      code: 'SESSION_NOT_FOUND',
      message: `Session "${id}" no encontrada.`,
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

/**
 * `true` si el error es 23503 + el constraint mentioned matchea `constraintName`.
 * (Re-implementación local — el helper análogo vive en `routines.service.ts`.
 * Puede extraerse a `common/` cuando aparezca un tercer caller.)
 */
export function isForeignKeyViolation(
  err: unknown,
  constraintName: string,
): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const driverError = (err as { driverError?: { code?: string } }).driverError;
  if (driverError?.code !== '23503') return false;
  return err.message.includes(constraintName);
}
