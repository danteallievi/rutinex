import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { CreateExerciseDto } from './dto/create-exercise.dto';
import type { ExerciseResponse } from './dto/exercise.response';
import {
  toExerciseResponse,
  type PaginatedExercisesResponse,
} from './dto/exercise.response';
import type { ListExercisesQueryDto } from './dto/list-exercises.query.dto';
import type { UpdateExerciseDto } from './dto/update-exercise.dto';
import { Exercise, type ExerciseMediaType } from './entities/exercise.entity';
import { ExercisesRepository } from './exercises.repository';

/**
 * CRUD del catálogo de ejercicios del tenant (Step 14).
 *
 * El controller deja el guard chain (Jwt + Tenant + Roles) hacer su trabajo;
 * acá nos limitamos a:
 * - Validar coherencia `mediaType`↔`mediaUrl` (assertion con `code` parseable).
 * - Lookup tenant-scoped (cross-tenant devuelve 404 sin filtrar existencia).
 * - Filtros opcionales `q` (ILIKE en `title`) y `muscleGroups` (overlap `&&`
 *   de Postgres).
 *
 * Sin distinciones de rol del actor dentro del service: `STUDENT` puede leer
 * todo el catálogo y `OWNER`/`TRAINER` crean/editan/borran — el gate vive en
 * el controller (`@Roles`).
 */
@Injectable()
export class ExercisesService {
  constructor(private readonly exercisesRepository: ExercisesRepository) {}

  async create(
    tenantId: string,
    createdBy: string,
    dto: CreateExerciseDto,
  ): Promise<ExerciseResponse> {
    this.assertMediaCoherent(dto.mediaType, dto.mediaUrl ?? null);

    const entity = this.exercisesRepository.create({
      tenantId,
      title: dto.title,
      description: dto.description ?? '',
      mediaType: dto.mediaType,
      mediaUrl: dto.mediaUrl ?? null,
      muscleGroups: dto.muscleGroups ?? [],
      createdBy,
    });
    const saved = await this.exercisesRepository.save(entity);
    return toExerciseResponse(saved);
  }

  async list(
    tenantId: string,
    query: ListExercisesQueryDto,
  ): Promise<PaginatedExercisesResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Usamos QueryBuilder para los filtros `q` (ILIKE) y `muscleGroups`
    // (overlap `&&`). El wrapper TenantScopedRepository no chequea queries
    // hechas por QB, así que el filtro `tenant_id` es la primera cláusula
    // y siempre está presente.
    const qb = this.exercisesRepository
      .createQueryBuilder('exercise')
      .where('exercise.tenant_id = :tenantId', { tenantId });

    if (query.q !== undefined && query.q.length > 0) {
      qb.andWhere('exercise.title ILIKE :q', { q: `%${query.q}%` });
    }

    if (query.muscleGroups !== undefined && query.muscleGroups.length > 0) {
      qb.andWhere('exercise.muscle_groups && (:mg)::text[]', {
        mg: query.muscleGroups,
      });
    }

    const [rows, total] = await qb
      .orderBy('exercise.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      data: rows.map(toExerciseResponse),
      page,
      pageSize,
      total,
    };
  }

  async findOne(tenantId: string, id: string): Promise<ExerciseResponse> {
    const exercise = await this.findEntity(tenantId, id);
    return toExerciseResponse(exercise);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateExerciseDto,
  ): Promise<ExerciseResponse> {
    const existing = await this.findEntity(tenantId, id);

    const partial: Partial<Exercise> = {};
    if (dto.title !== undefined) partial.title = dto.title;
    if (dto.description !== undefined) partial.description = dto.description;
    if (dto.muscleGroups !== undefined) partial.muscleGroups = dto.muscleGroups;
    if (dto.mediaType !== undefined) partial.mediaType = dto.mediaType;
    if (dto.mediaUrl !== undefined) partial.mediaUrl = dto.mediaUrl;

    const nextMediaType = partial.mediaType ?? existing.mediaType;
    const nextMediaUrl =
      partial.mediaUrl !== undefined ? partial.mediaUrl : existing.mediaUrl;
    this.assertMediaCoherent(nextMediaType, nextMediaUrl);

    if (Object.keys(partial).length > 0) {
      await this.exercisesRepository.update({ tenantId, id }, partial);
    }

    return toExerciseResponse({ ...existing, ...partial });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const result = await this.exercisesRepository.delete({ tenantId, id });
    if (result.affected === 0) {
      throw this.notFound(id);
    }
  }

  private async findEntity(tenantId: string, id: string): Promise<Exercise> {
    const exercise = await this.exercisesRepository.findOne({
      where: { tenantId, id },
    });
    if (!exercise) {
      throw this.notFound(id);
    }
    return exercise;
  }

  private assertMediaCoherent(
    mediaType: ExerciseMediaType,
    mediaUrl: string | null,
  ): void {
    if (mediaType === 'none' && mediaUrl) {
      throw new BadRequestException({
        code: 'EXERCISE_MEDIA_INCONSISTENT',
        message: 'Cuando mediaType=none, mediaUrl debe ser null/ausente.',
      });
    }
    if (mediaType !== 'none' && !mediaUrl) {
      throw new BadRequestException({
        code: 'EXERCISE_MEDIA_INCONSISTENT',
        message:
          'mediaUrl es requerido cuando mediaType es video, gif o image.',
      });
    }
  }

  private notFound(id: string): NotFoundException {
    return new NotFoundException({
      code: 'EXERCISE_NOT_FOUND',
      message: `Exercise "${id}" no encontrado.`,
    });
  }
}
