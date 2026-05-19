import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import type { AuthenticatedUser } from '../auth/jwt-payload';
import { User } from '../users/entities/user.entity';
import type { PersonalRecordResponse } from './dto/personal-record.response';
import { toPersonalRecordResponse } from './dto/personal-record.response';
import type { PersonalRecordType } from './entities/personal-record.entity';
import { PersonalRecordsRepository } from './personal-records.repository';

/**
 * Personal Records (Step 19 / ADR-027).
 *
 * Materializa los 3 PRs por `(student, exercise)`:
 * - `max_weight`: peso más alto levantado.
 * - `max_reps_at_weight`: más reps en una serie (con el peso de esa serie).
 * - `max_volume`: mayor `weight × reps` en una serie.
 *
 * Sets con `weight_kg=null` (bodyweight) se **skipean** del cálculo en MVP — la
 * columna `personal_records.weight_kg` es NOT NULL. Si en el futuro queremos PR
 * bodyweight, se modela aparte (otro `record_type` o tabla separada).
 *
 * **Concurrencia**: el cálculo corre dentro de la misma transacción que el
 * INSERT del set (llamado desde `SessionsService.addSet`). Cada PR se persiste
 * con `INSERT … ON CONFLICT (tenant_id, student_id, exercise_id, record_type)
 * DO UPDATE … WHERE pr.<metric> < EXCLUDED.<metric>`. Postgres serializa el
 * conflict-resolution con row lock sobre el índice único — dos sets
 * concurrentes del mismo `(student, exercise)` no se pisan: ambos UPSERTs se
 * ejecutan, el strict `<` en el WHERE garantiza que sólo gana el mejor y
 * cualquier empate mantiene el row existente (hard-PR, ADR-027 §3).
 *
 * **Jerarquía de lectura**: OWNER ve cualquier student del tenant; TRAINER ve
 * sólo los suyos (`student.trainerId === actor.userId`); STUDENT sólo `self`.
 */
@Injectable()
export class PersonalRecordsService {
  constructor(
    private readonly personalRecordsRepository: PersonalRecordsRepository,
    private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------------------
  // Cálculo (llamado desde la transacción de addSet)
  // ---------------------------------------------------------------------------

  /**
   * Evalúa los 3 record_types para el set recién insertado y upsertea cada
   * uno con `ON CONFLICT … DO UPDATE … WHERE EXCLUDED > pr` para preservar
   * atomicidad ante concurrencia. Idempotente: re-ejecutar con el mismo set
   * (mismo `setId`) no actualiza nada porque las métricas son iguales.
   *
   * Sets con `weightKg=null` no producen PR.
   */
  async computeAndUpsertForSet(
    manager: EntityManager,
    args: {
      tenantId: string;
      studentId: string;
      exerciseId: string;
      setId: string;
      reps: number;
      weightKg: number | null;
    },
  ): Promise<void> {
    if (args.weightKg === null) return;

    const weightStr = args.weightKg.toFixed(2);

    // Cada tipo trae su propio WHERE estricto: el row sólo se actualiza si la
    // métrica del set supera (no iguala) al PR existente. El INSERT inicial
    // crea el row si no había PR previo (el WHERE no aplica al insert).
    const types: Array<{
      recordType: PersonalRecordType;
      betterThanExisting: string;
    }> = [
      {
        recordType: 'max_weight',
        betterThanExisting: 'personal_records.weight_kg < EXCLUDED.weight_kg',
      },
      {
        recordType: 'max_reps_at_weight',
        betterThanExisting: 'personal_records.reps < EXCLUDED.reps',
      },
      {
        recordType: 'max_volume',
        betterThanExisting:
          '(personal_records.weight_kg * personal_records.reps) < (EXCLUDED.weight_kg * EXCLUDED.reps)',
      },
    ];

    for (const t of types) {
      await manager.query(
        `INSERT INTO personal_records (
          tenant_id, student_id, exercise_id, record_type,
          weight_kg, reps, set_id, achieved_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
        ON CONFLICT (tenant_id, student_id, exercise_id, record_type)
        DO UPDATE SET
          weight_kg = EXCLUDED.weight_kg,
          reps = EXCLUDED.reps,
          set_id = EXCLUDED.set_id,
          achieved_at = EXCLUDED.achieved_at
        WHERE ${t.betterThanExisting}`,
        [
          args.tenantId,
          args.studentId,
          args.exerciseId,
          t.recordType,
          weightStr,
          args.reps,
          args.setId,
        ],
      );
    }
  }

  // ---------------------------------------------------------------------------
  // GET /students/:id/personal-records
  // ---------------------------------------------------------------------------

  async listByStudent(
    tenantId: string,
    actor: AuthenticatedUser,
    studentId: string,
  ): Promise<PersonalRecordResponse[]> {
    await this.assertActorCanReadStudent(tenantId, actor, studentId);
    const rows = await this.personalRecordsRepository.find({
      where: { tenantId, studentId },
      order: { exerciseId: 'ASC', recordType: 'ASC' },
    });
    return rows.map(toPersonalRecordResponse);
  }

  // ---------------------------------------------------------------------------
  // GET /students/:id/personal-records/:exerciseId
  // ---------------------------------------------------------------------------

  async listByStudentAndExercise(
    tenantId: string,
    actor: AuthenticatedUser,
    studentId: string,
    exerciseId: string,
  ): Promise<PersonalRecordResponse[]> {
    await this.assertActorCanReadStudent(tenantId, actor, studentId);
    const rows = await this.personalRecordsRepository.find({
      where: { tenantId, studentId, exerciseId },
      order: { recordType: 'ASC' },
    });
    return rows.map(toPersonalRecordResponse);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Valida que el `studentId` existe en el tenant como STUDENT y que el actor
   * tiene jerarquía para leerlo. 404 cross-tenant / inexistente / no-STUDENT
   * (no se filtra existencia, alineado con sessions/assignments).
   */
  private async assertActorCanReadStudent(
    tenantId: string,
    actor: AuthenticatedUser,
    studentId: string,
  ): Promise<void> {
    const student = await this.dataSource.getRepository(User).findOne({
      where: { tenantId, id: studentId },
    });
    if (!student || student.role !== 'STUDENT') {
      throw new NotFoundException({
        code: 'STUDENT_NOT_FOUND',
        message: `Student "${studentId}" no encontrado.`,
      });
    }
    if (actor.role === 'OWNER') return;
    if (actor.role === 'TRAINER' && student.trainerId === actor.userId) return;
    if (actor.role === 'STUDENT' && actor.userId === student.id) return;
    throw new ForbiddenException({
      code: 'FORBIDDEN_ROLE_HIERARCHY',
      message: 'No podés leer PRs de este alumno.',
    });
  }
}
