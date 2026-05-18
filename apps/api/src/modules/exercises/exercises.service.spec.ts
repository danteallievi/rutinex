import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import type { CreateExerciseDto } from './dto/create-exercise.dto';
import type { UpdateExerciseDto } from './dto/update-exercise.dto';
import { Exercise } from './entities/exercise.entity';
import { ExercisesRepository } from './exercises.repository';
import { ExercisesService } from './exercises.service';

type MockQB = {
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getManyAndCount: jest.Mock;
};

type MockRepo = {
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  createQueryBuilder: jest.Mock;
  __qb: MockQB;
};

function makeQB(): MockQB {
  const qb: MockQB = {
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.skip.mockReturnValue(qb);
  qb.take.mockReturnValue(qb);
  return qb;
}

function makeMockRepo(): MockRepo {
  const now = new Date('2026-05-18T10:00:00.000Z');
  const qb = makeQB();
  return {
    create: jest.fn((input: Partial<Exercise>) => input as Exercise),
    save: jest.fn((input: Exercise) =>
      Promise.resolve({
        ...input,
        id: 'new-exercise-id',
        createdAt: now,
        updatedAt: now,
      }),
    ),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    __qb: qb,
  };
}

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ACTOR_ID = '00000000-0000-0000-0000-000000000010';
const EXERCISE_ID = '00000000-0000-0000-0000-0000000000a1';

function baseExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: EXERCISE_ID,
    tenantId: TENANT_ID,
    title: 'Press de banca',
    description: '',
    mediaUrl: null,
    mediaType: 'none',
    muscleGroups: ['chest'],
    createdBy: ACTOR_ID,
    createdAt: new Date('2026-05-18T10:00:00.000Z'),
    updatedAt: new Date('2026-05-18T10:00:00.000Z'),
    ...overrides,
  };
}

function createDto(
  overrides: Partial<CreateExerciseDto> = {},
): CreateExerciseDto {
  return {
    title: 'Press de banca',
    mediaType: 'none',
    muscleGroups: ['chest'],
    ...overrides,
  };
}

describe('ExercisesService', () => {
  let service: ExercisesService;
  let repo: MockRepo;

  beforeEach(async () => {
    repo = makeMockRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExercisesService,
        { provide: ExercisesRepository, useValue: repo },
      ],
    }).compile();
    service = module.get<ExercisesService>(ExercisesService);
  });

  describe('create', () => {
    it('mediaType=none + sin mediaUrl → OK, defaults aplicados', async () => {
      const res = await service.create(TENANT_ID, ACTOR_ID, createDto());
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          createdBy: ACTOR_ID,
          mediaType: 'none',
          mediaUrl: null,
          muscleGroups: ['chest'],
          description: '',
        }),
      );
      expect(res.id).toBe('new-exercise-id');
      expect(res.mediaType).toBe('none');
    });

    it('mediaType=video + mediaUrl → OK', async () => {
      const res = await service.create(
        TENANT_ID,
        ACTOR_ID,
        createDto({ mediaType: 'video', mediaUrl: 'https://r2.test/x.mp4' }),
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaType: 'video',
          mediaUrl: 'https://r2.test/x.mp4',
        }),
      );
      expect(res.mediaUrl).toBe('https://r2.test/x.mp4');
    });

    it('mediaType=none + mediaUrl → 400 EXERCISE_MEDIA_INCONSISTENT', async () => {
      await expect(
        service.create(
          TENANT_ID,
          ACTOR_ID,
          createDto({ mediaType: 'none', mediaUrl: 'https://x.test/y.mp4' }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('mediaType=video sin mediaUrl → 400 EXERCISE_MEDIA_INCONSISTENT', async () => {
      await expect(
        service.create(TENANT_ID, ACTOR_ID, createDto({ mediaType: 'video' })),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('muscleGroups default a [] cuando no se pasa', async () => {
      const dto: CreateExerciseDto = {
        title: 'Plancha',
        mediaType: 'none',
      };
      await service.create(TENANT_ID, ACTOR_ID, dto);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ muscleGroups: [] }),
      );
    });
  });

  describe('list', () => {
    it('arma where tenant_id + paginación + orden createdAt DESC', async () => {
      repo.__qb.getManyAndCount.mockResolvedValueOnce([[baseExercise()], 1]);
      const res = await service.list(TENANT_ID, { page: 1, pageSize: 20 });
      expect(repo.__qb.where).toHaveBeenCalledWith(
        'exercise.tenant_id = :tenantId',
        { tenantId: TENANT_ID },
      );
      expect(repo.__qb.orderBy).toHaveBeenCalledWith(
        'exercise.created_at',
        'DESC',
      );
      expect(repo.__qb.skip).toHaveBeenCalledWith(0);
      expect(repo.__qb.take).toHaveBeenCalledWith(20);
      expect(res.total).toBe(1);
      expect(res.data[0]!.id).toBe(EXERCISE_ID);
    });

    it('agrega ILIKE cuando viene q', async () => {
      repo.__qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
      await service.list(TENANT_ID, { q: 'press' });
      expect(repo.__qb.andWhere).toHaveBeenCalledWith(
        'exercise.title ILIKE :q',
        { q: '%press%' },
      );
    });

    it('agrega overlap && cuando viene muscleGroups', async () => {
      repo.__qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
      await service.list(TENANT_ID, { muscleGroups: ['chest', 'triceps'] });
      expect(repo.__qb.andWhere).toHaveBeenCalledWith(
        'exercise.muscle_groups && (:mg)::text[]',
        { mg: ['chest', 'triceps'] },
      );
    });

    it('q vacío no agrega filtro', async () => {
      repo.__qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
      await service.list(TENANT_ID, { q: '' });
      const calls = (
        repo.__qb.andWhere.mock.calls as unknown as [string, unknown][]
      ).map((c) => c[0]);
      expect(calls.some((c) => c.includes('ILIKE'))).toBe(false);
    });

    it('muscleGroups vacío no agrega filtro', async () => {
      repo.__qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
      await service.list(TENANT_ID, { muscleGroups: [] });
      const calls = (
        repo.__qb.andWhere.mock.calls as unknown as [string, unknown][]
      ).map((c) => c[0]);
      expect(calls.some((c) => c.includes('muscle_groups'))).toBe(false);
    });

    it('paginación page=3, pageSize=10 → skip=20, take=10', async () => {
      repo.__qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
      await service.list(TENANT_ID, { page: 3, pageSize: 10 });
      expect(repo.__qb.skip).toHaveBeenCalledWith(20);
      expect(repo.__qb.take).toHaveBeenCalledWith(10);
    });
  });

  describe('findOne', () => {
    it('encuentra por (tenantId, id) y devuelve response', async () => {
      repo.findOne.mockResolvedValueOnce(baseExercise());
      const res = await service.findOne(TENANT_ID, EXERCISE_ID);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, id: EXERCISE_ID },
      });
      expect(res.id).toBe(EXERCISE_ID);
    });

    it('no existe → 404 EXERCISE_NOT_FOUND', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(service.findOne(TENANT_ID, EXERCISE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('parcial OK (sólo title)', async () => {
      repo.findOne.mockResolvedValueOnce(baseExercise());
      const dto: UpdateExerciseDto = { title: 'Press inclinado' };
      const res = await service.update(TENANT_ID, EXERCISE_ID, dto);
      expect(repo.update).toHaveBeenCalledWith(
        { tenantId: TENANT_ID, id: EXERCISE_ID },
        { title: 'Press inclinado' },
      );
      expect(res.title).toBe('Press inclinado');
    });

    it('no existe → 404', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.update(TENANT_ID, EXERCISE_ID, { title: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('cambiar mediaType=none → mediaUrl debe quedar null (rechaza si no se limpia)', async () => {
      repo.findOne.mockResolvedValueOnce(
        baseExercise({ mediaType: 'video', mediaUrl: 'https://x.test/y.mp4' }),
      );
      await expect(
        service.update(TENANT_ID, EXERCISE_ID, { mediaType: 'none' }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('cambiar mediaType=none + mediaUrl=null → OK', async () => {
      repo.findOne.mockResolvedValueOnce(
        baseExercise({ mediaType: 'video', mediaUrl: 'https://x.test/y.mp4' }),
      );
      const res = await service.update(TENANT_ID, EXERCISE_ID, {
        mediaType: 'none',
        mediaUrl: null,
      });
      expect(repo.update).toHaveBeenCalledWith(
        { tenantId: TENANT_ID, id: EXERCISE_ID },
        { mediaType: 'none', mediaUrl: null },
      );
      expect(res.mediaUrl).toBeNull();
    });

    it('cambiar mediaType=video manteniendo el mediaUrl existente → OK', async () => {
      repo.findOne.mockResolvedValueOnce(
        baseExercise({ mediaType: 'gif', mediaUrl: 'https://x.test/y.gif' }),
      );
      const res = await service.update(TENANT_ID, EXERCISE_ID, {
        mediaType: 'video',
      });
      expect(res.mediaType).toBe('video');
      expect(res.mediaUrl).toBe('https://x.test/y.gif');
    });

    it('PATCH vacío → no llama a update', async () => {
      repo.findOne.mockResolvedValueOnce(baseExercise());
      await service.update(TENANT_ID, EXERCISE_ID, {});
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('OK → delete por (tenantId, id)', async () => {
      repo.delete.mockResolvedValueOnce({ affected: 1 });
      await service.remove(TENANT_ID, EXERCISE_ID);
      expect(repo.delete).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        id: EXERCISE_ID,
      });
    });

    it('no existe → 404', async () => {
      repo.delete.mockResolvedValueOnce({ affected: 0 });
      await expect(service.remove(TENANT_ID, EXERCISE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
