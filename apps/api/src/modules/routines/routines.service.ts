import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';

import { Exercise } from '../exercises/entities/exercise.entity';
import type { CreateRoutineDto } from './dto/create-routine.dto';
import type { ListRoutinesQueryDto } from './dto/list-routines.query.dto';
import type {
  PaginatedRoutinesResponse,
  RoutineResponse,
} from './dto/routine.response';
import {
  toRoutineListItemResponse,
  toRoutineResponse,
} from './dto/routine.response';
import type { RoutineItemInputDto } from './dto/routine-item-input.dto';
import type { UpdateRoutineDto } from './dto/update-routine.dto';
import { RoutineItem } from './entities/routine-item.entity';
import { Routine } from './entities/routine.entity';
import { RoutinesRepository } from './routines.repository';

/**
 * CRUD de routines + sus routine_items embebidos (Step 16).
 *
 * Reglas:
 * - `POST /routines` y `PATCH /routines/:id` con items corren en una sola
 *   transacción (atomicidad real: o queda todo o no queda nada).
 * - Los `exerciseId`s deben pertenecer al mismo tenant — se valida con un
 *   lookup batch que tira 400 `ROUTINE_ITEM_EXERCISE_NOT_FOUND` antes de
 *   tocar `routine_items`.
 * - `position` se normaliza a 1..N basado en el orden recibido (preserva
 *   secuencias arbitrarias como 10/20/30 y las colapsa a 1/2/3). Cliente no
 *   tiene que mandar positions consecutivas, sólo el orden relativo.
 * - PATCH con `items` reemplaza el array completo (delete-then-insert). PATCH
 *   sin `items` deja los existentes intactos.
 * - Hard delete (cascade a routine_items por la FK con `ON DELETE CASCADE`).
 */
@Injectable()
export class RoutinesService {
  constructor(
    private readonly routinesRepository: RoutinesRepository,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    tenantId: string,
    createdBy: string,
    dto: CreateRoutineDto,
  ): Promise<RoutineResponse> {
    this.assertPositionsUnique(dto.items);

    return this.dataSource.transaction(async (manager) => {
      const exercisesById = await this.loadAndAssertExercises(
        manager.getRepository(Exercise),
        tenantId,
        dto.items.map((i) => i.exerciseId),
      );

      const routineRepo = manager.getRepository(Routine);
      const routine = await routineRepo.save(
        routineRepo.create({
          tenantId,
          name: dto.name,
          description: dto.description ?? null,
          createdBy,
        }),
      );

      const itemRepo = manager.getRepository(RoutineItem);
      const items = this.buildItemEntities(tenantId, routine.id, dto.items);
      const savedItems = await itemRepo.save(
        items.map((i) => itemRepo.create(i)),
      );

      return toRoutineResponse(routine, savedItems, exercisesById);
    });
  }

  async list(
    tenantId: string,
    query: ListRoutinesQueryDto,
  ): Promise<PaginatedRoutinesResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // QueryBuilder con tenant_id como primera cláusula (convención del wrapper
    // — ver ExercisesService.list).
    const qb = this.routinesRepository
      .createQueryBuilder('routine')
      .where('routine.tenant_id = :tenantId', { tenantId });

    if (query.q !== undefined && query.q.length > 0) {
      qb.andWhere('routine.name ILIKE :q', { q: `%${query.q}%` });
    }

    const [rows, total] = await qb
      .orderBy('routine.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    // itemsCount en una sola query, mapeado por routineId.
    const countsByRoutine = await this.loadItemsCounts(
      tenantId,
      rows.map((r) => r.id),
    );

    return {
      data: rows.map((r) =>
        toRoutineListItemResponse(r, countsByRoutine.get(r.id) ?? 0),
      ),
      page,
      pageSize,
      total,
    };
  }

  async findOne(tenantId: string, id: string): Promise<RoutineResponse> {
    const routine = await this.findEntity(tenantId, id);
    const items = await this.dataSource
      .getRepository(RoutineItem)
      .find({ where: { tenantId, routineId: routine.id } });

    const exercisesById = await this.loadExercisesMap(
      tenantId,
      items.map((i) => i.exerciseId),
    );
    return toRoutineResponse(routine, items, exercisesById);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateRoutineDto,
  ): Promise<RoutineResponse> {
    if (dto.items !== undefined) {
      this.assertPositionsUnique(dto.items);
    }

    return this.dataSource.transaction(async (manager) => {
      const routineRepo = manager.getRepository(Routine);
      const existing = await routineRepo.findOne({
        where: { tenantId, id },
      });
      if (!existing) {
        throw this.notFound(id);
      }

      const partial: Partial<Routine> = {};
      if (dto.name !== undefined) partial.name = dto.name;
      if (dto.description !== undefined)
        partial.description = dto.description ?? null;

      if (Object.keys(partial).length > 0) {
        await routineRepo.update({ id }, partial);
        Object.assign(existing, partial);
      }

      let items: RoutineItem[];
      if (dto.items !== undefined) {
        const itemRepo = manager.getRepository(RoutineItem);
        await this.loadAndAssertExercises(
          manager.getRepository(Exercise),
          tenantId,
          dto.items.map((i) => i.exerciseId),
        );
        await itemRepo.delete({ tenantId, routineId: existing.id });
        const newItems = this.buildItemEntities(
          tenantId,
          existing.id,
          dto.items,
        );
        items = await itemRepo.save(newItems.map((i) => itemRepo.create(i)));
        // Tocar updatedAt manualmente: el delete/insert de items no dispara
        // el @UpdateDateColumn del routine.
        await routineRepo.update({ id }, { updatedAt: new Date() });
      } else {
        items = await manager
          .getRepository(RoutineItem)
          .find({ where: { tenantId, routineId: existing.id } });
      }

      // Releer el routine para tener `updatedAt` actualizado.
      const refreshed = await routineRepo.findOne({
        where: { tenantId, id: existing.id },
      });

      const exercisesById = await this.loadExercisesMap(
        tenantId,
        items.map((i) => i.exerciseId),
        manager.getRepository(Exercise),
      );

      return toRoutineResponse(refreshed ?? existing, items, exercisesById);
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    try {
      const result = await this.routinesRepository.delete({ tenantId, id });
      if (result.affected === 0) {
        throw this.notFound(id);
      }
    } catch (err) {
      // Si la rutina está referenciada por assignments (FK RESTRICT,
      // Step 17 / ADR-025), Postgres tira 23503. Traducimos a 409 con
      // `ROUTINE_HAS_ASSIGNMENTS` — el frontend pide al user que borre
      // las asignaciones primero.
      if (isForeignKeyViolation(err, 'fk_assignments_routine')) {
        throw new ConflictException({
          code: 'ROUTINE_HAS_ASSIGNMENTS',
          message:
            'No se puede borrar la rutina: tiene asignaciones activas. Borrá las asignaciones primero.',
        });
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async findEntity(tenantId: string, id: string): Promise<Routine> {
    const routine = await this.routinesRepository.findOne({
      where: { tenantId, id },
    });
    if (!routine) {
      throw this.notFound(id);
    }
    return routine;
  }

  private assertPositionsUnique(items: RoutineItemInputDto[]): void {
    const seen = new Set<number>();
    for (const item of items) {
      if (seen.has(item.position)) {
        throw new BadRequestException({
          code: 'ROUTINE_ITEM_POSITION_DUPLICATED',
          message: `position duplicada: ${String(item.position)}`,
        });
      }
      seen.add(item.position);
    }
  }

  /**
   * Lookup batch de exercises por (tenantId, id IN (...)). Devuelve un map
   * { exerciseId → Exercise }. Si falta algún id, tira 400
   * `ROUTINE_ITEM_EXERCISE_NOT_FOUND` con la lista de ids faltantes.
   */
  private async loadAndAssertExercises(
    exercisesRepo: Repository<Exercise>,
    tenantId: string,
    exerciseIds: string[],
  ): Promise<Map<string, Exercise>> {
    const uniqueIds = Array.from(new Set(exerciseIds));
    if (uniqueIds.length === 0) {
      return new Map();
    }
    const found = await exercisesRepo.find({
      where: { tenantId, id: In(uniqueIds) },
    });
    const byId = new Map(found.map((e) => [e.id, e]));
    const missing = uniqueIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw new BadRequestException({
        code: 'ROUTINE_ITEM_EXERCISE_NOT_FOUND',
        message: `Algunos exerciseId no existen en este tenant: ${missing.join(', ')}`,
      });
    }
    return byId;
  }

  private async loadExercisesMap(
    tenantId: string,
    exerciseIds: string[],
    exercisesRepo: Repository<Exercise> = this.dataSource.getRepository(
      Exercise,
    ),
  ): Promise<Map<string, Exercise>> {
    const uniqueIds = Array.from(new Set(exerciseIds));
    if (uniqueIds.length === 0) return new Map();
    const found = await exercisesRepo.find({
      where: { tenantId, id: In(uniqueIds) },
    });
    return new Map(found.map((e) => [e.id, e]));
  }

  /**
   * Normaliza `position` a 1..N basado en el orden recibido en el array
   * (preservando el orden relativo; positions arbitrarias como 10/20/30 se
   * colapsan a 1/2/3). Esto deja la columna `position` siempre consecutiva
   * sin requerir que el cliente la mande así.
   */
  private buildItemEntities(
    tenantId: string,
    routineId: string,
    inputs: RoutineItemInputDto[],
  ): Partial<RoutineItem>[] {
    const sorted = [...inputs].sort((a, b) => a.position - b.position);
    return sorted.map((input, index) => ({
      tenantId,
      routineId,
      exerciseId: input.exerciseId,
      position: index + 1,
      prescribedSets: input.prescribedSets,
      prescribedReps: input.prescribedReps,
      prescribedWeight: input.prescribedWeight ?? null,
      restSeconds: input.restSeconds ?? null,
      notes: input.notes ?? null,
    }));
  }

  private async loadItemsCounts(
    tenantId: string,
    routineIds: string[],
  ): Promise<Map<string, number>> {
    if (routineIds.length === 0) return new Map();
    const rows = await this.dataSource
      .getRepository(RoutineItem)
      .createQueryBuilder('item')
      .select('item.routine_id', 'routineId')
      .addSelect('COUNT(*)', 'count')
      .where('item.tenant_id = :tenantId', { tenantId })
      .andWhere('item.routine_id IN (:...routineIds)', { routineIds })
      .groupBy('item.routine_id')
      .getRawMany<{ routineId: string; count: string }>();
    return new Map(rows.map((r) => [r.routineId, Number(r.count)]));
  }

  private notFound(id: string): NotFoundException {
    return new NotFoundException({
      code: 'ROUTINE_NOT_FOUND',
      message: `Routine "${id}" no encontrada.`,
    });
  }
}

/**
 * `true` si el error es un `QueryFailedError` por violación de FK (Postgres
 * SQLSTATE 23503) y el constraint mencionado matchea `constraintName`.
 * Match exacto por nombre — alcanza con `includes` porque PG mete el nombre
 * literal en el mensaje del driverError (`update or delete on table "X"
 * violates foreign key constraint "fk_assignments_routine" on table "Y"`).
 */
function isForeignKeyViolation(err: unknown, constraintName: string): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const driverError = (err as { driverError?: { code?: string } }).driverError;
  if (driverError?.code !== '23503') return false;
  return err.message.includes(constraintName);
}
