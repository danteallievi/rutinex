import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { Exercise } from '../exercises/entities/exercise.entity';
import type { CreateRoutineDto } from './dto/create-routine.dto';
import type { UpdateRoutineDto } from './dto/update-routine.dto';
import { RoutineItem } from './entities/routine-item.entity';
import { Routine } from './entities/routine.entity';
import { RoutinesRepository } from './routines.repository';
import { RoutinesService } from './routines.service';

type MockQB = {
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getManyAndCount: jest.Mock;
  select: jest.Mock;
  addSelect: jest.Mock;
  groupBy: jest.Mock;
  getRawMany: jest.Mock;
};

function makeQB(): MockQB {
  const qb: MockQB = {
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    select: jest.fn(),
    addSelect: jest.fn(),
    groupBy: jest.fn(),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.skip.mockReturnValue(qb);
  qb.take.mockReturnValue(qb);
  qb.select.mockReturnValue(qb);
  qb.addSelect.mockReturnValue(qb);
  qb.groupBy.mockReturnValue(qb);
  return qb;
}

type RoutinesRepoMock = {
  findOne: jest.Mock;
  delete: jest.Mock;
  update: jest.Mock;
  createQueryBuilder: jest.Mock;
  __qb: MockQB;
};

type RepoMock = {
  findOne: jest.Mock;
  find: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  createQueryBuilder: jest.Mock;
  __qb: MockQB;
};

function makeRoutinesRepo(): RoutinesRepoMock {
  const qb = makeQB();
  return {
    findOne: jest.fn(),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    __qb: qb,
  };
}

function makeRepo(): RepoMock {
  const qb = makeQB();
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
    create: jest.fn((input: unknown) => input),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    __qb: qb,
  };
}

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ACTOR_ID = '00000000-0000-0000-0000-000000000010';
const ROUTINE_ID = '00000000-0000-0000-0000-0000000000a1';
const EX_ID_1 = '00000000-0000-0000-0000-0000000000e1';
const EX_ID_2 = '00000000-0000-0000-0000-0000000000e2';

function baseRoutine(overrides: Partial<Routine> = {}): Routine {
  const now = new Date('2026-05-18T10:00:00.000Z');
  return {
    id: ROUTINE_ID,
    tenantId: TENANT_ID,
    name: 'Tren superior',
    description: null,
    createdBy: ACTOR_ID,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function baseExercise(id: string, overrides: Partial<Exercise> = {}): Exercise {
  const now = new Date('2026-05-18T10:00:00.000Z');
  return {
    id,
    tenantId: TENANT_ID,
    title: 'Press',
    description: '',
    mediaUrl: null,
    mediaType: 'none',
    muscleGroups: ['chest'],
    createdBy: ACTOR_ID,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function baseRoutineItem(overrides: Partial<RoutineItem> = {}): RoutineItem {
  return {
    id: 'item-1',
    tenantId: TENANT_ID,
    routineId: ROUTINE_ID,
    exerciseId: EX_ID_1,
    position: 1,
    prescribedSets: 3,
    prescribedReps: '10',
    prescribedWeight: null,
    restSeconds: null,
    notes: null,
    ...overrides,
  };
}

function createDto(
  overrides: Partial<CreateRoutineDto> = {},
): CreateRoutineDto {
  return {
    name: 'Tren superior',
    items: [
      {
        exerciseId: EX_ID_1,
        position: 1,
        prescribedSets: 3,
        prescribedReps: '10',
      },
    ],
    ...overrides,
  };
}

describe('RoutinesService', () => {
  let service: RoutinesService;
  let routinesRepo: RoutinesRepoMock;
  let routineRepo: RepoMock;
  let routineItemRepo: RepoMock;
  let exerciseRepo: RepoMock;

  const buildDataSource = (): DataSource => {
    const getRepository = jest.fn().mockImplementation((entity: unknown) => {
      if (entity === Routine) return routineRepo;
      if (entity === RoutineItem) return routineItemRepo;
      if (entity === Exercise) return exerciseRepo;
      throw new Error(`Unexpected entity in getRepository: ${String(entity)}`);
    });
    const transaction = jest
      .fn()
      .mockImplementation(
        (cb: (manager: { getRepository: typeof getRepository }) => unknown) =>
          cb({ getRepository }),
      );
    return { getRepository, transaction } as unknown as DataSource;
  };

  beforeEach(async () => {
    routinesRepo = makeRoutinesRepo();
    routineRepo = makeRepo();
    routineItemRepo = makeRepo();
    exerciseRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutinesService,
        { provide: RoutinesRepository, useValue: routinesRepo },
        { provide: DataSource, useValue: buildDataSource() },
      ],
    }).compile();
    service = module.get<RoutinesService>(RoutinesService);
  });

  describe('create', () => {
    it('crea routine + items atómico, normaliza positions a 1..N', async () => {
      exerciseRepo.find.mockResolvedValueOnce([baseExercise(EX_ID_1)]);
      routineRepo.save.mockResolvedValueOnce(baseRoutine());
      routineItemRepo.save.mockImplementationOnce(
        (items: Partial<RoutineItem>[]) =>
          Promise.resolve(
            items.map((i, idx) => ({
              ...baseRoutineItem(),
              ...i,
              id: `item-${idx + 1}`,
            })),
          ),
      );

      const res = await service.create(TENANT_ID, ACTOR_ID, createDto());

      expect(routineRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          name: 'Tren superior',
          description: null,
          createdBy: ACTOR_ID,
        }),
      );
      expect(routineItemRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({
          tenantId: TENANT_ID,
          routineId: ROUTINE_ID,
          exerciseId: EX_ID_1,
          position: 1,
        }),
      ]);
      expect(res.items.length).toBe(1);
      expect(res.items[0]!.position).toBe(1);
    });

    it('positions arbitrarias 10/20 → se normalizan a 1/2 preservando orden', async () => {
      exerciseRepo.find.mockResolvedValueOnce([
        baseExercise(EX_ID_1),
        baseExercise(EX_ID_2, { title: 'Sentadilla' }),
      ]);
      routineRepo.save.mockResolvedValueOnce(baseRoutine());
      routineItemRepo.save.mockImplementationOnce(
        (items: Partial<RoutineItem>[]) =>
          Promise.resolve(
            items.map((i, idx) => ({
              ...baseRoutineItem(),
              ...i,
              id: `item-${idx + 1}`,
            })),
          ),
      );

      const res = await service.create(
        TENANT_ID,
        ACTOR_ID,
        createDto({
          items: [
            {
              exerciseId: EX_ID_2,
              position: 20,
              prescribedSets: 4,
              prescribedReps: '8',
            },
            {
              exerciseId: EX_ID_1,
              position: 10,
              prescribedSets: 3,
              prescribedReps: '10',
            },
          ],
        }),
      );

      expect(res.items.map((i) => i.position)).toEqual([1, 2]);
      expect(res.items[0]!.exerciseId).toBe(EX_ID_1);
      expect(res.items[1]!.exerciseId).toBe(EX_ID_2);
    });

    it('exerciseId no existe en el tenant → 400 ROUTINE_ITEM_EXERCISE_NOT_FOUND', async () => {
      exerciseRepo.find.mockResolvedValueOnce([]);
      await expect(
        service.create(TENANT_ID, ACTOR_ID, createDto()),
      ).rejects.toThrow(BadRequestException);
      expect(routineRepo.save).not.toHaveBeenCalled();
      expect(routineItemRepo.save).not.toHaveBeenCalled();
    });

    it('positions duplicadas → 400 ROUTINE_ITEM_POSITION_DUPLICATED', async () => {
      await expect(
        service.create(
          TENANT_ID,
          ACTOR_ID,
          createDto({
            items: [
              {
                exerciseId: EX_ID_1,
                position: 1,
                prescribedSets: 3,
                prescribedReps: '10',
              },
              {
                exerciseId: EX_ID_2,
                position: 1,
                prescribedSets: 3,
                prescribedReps: '10',
              },
            ],
          }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(exerciseRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('arma where tenant_id + paginación + orden createdAt DESC + itemsCount', async () => {
      const routine = baseRoutine();
      routinesRepo.__qb.getManyAndCount.mockResolvedValueOnce([[routine], 1]);
      routineItemRepo.__qb.getRawMany.mockResolvedValueOnce([
        { routineId: ROUTINE_ID, count: '3' },
      ]);

      const res = await service.list(TENANT_ID, {
        page: 1,
        pageSize: 20,
      });

      expect(routinesRepo.__qb.where).toHaveBeenCalledWith(
        'routine.tenant_id = :tenantId',
        { tenantId: TENANT_ID },
      );
      expect(routinesRepo.__qb.orderBy).toHaveBeenCalledWith(
        'routine.created_at',
        'DESC',
      );
      expect(routinesRepo.__qb.skip).toHaveBeenCalledWith(0);
      expect(routinesRepo.__qb.take).toHaveBeenCalledWith(20);
      expect(res.total).toBe(1);
      expect(res.data[0]!.itemsCount).toBe(3);
    });

    it('agrega ILIKE cuando viene q', async () => {
      routinesRepo.__qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
      await service.list(TENANT_ID, { q: 'tren' });
      expect(routinesRepo.__qb.andWhere).toHaveBeenCalledWith(
        'routine.name ILIKE :q',
        { q: '%tren%' },
      );
    });

    it('lista vacía no consulta itemsCount', async () => {
      routinesRepo.__qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
      const res = await service.list(TENANT_ID, {});
      expect(routineItemRepo.__qb.getRawMany).not.toHaveBeenCalled();
      expect(res.data).toEqual([]);
      expect(res.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('OK: devuelve routine + items + exercises', async () => {
      const routine = baseRoutine();
      routinesRepo.findOne.mockResolvedValueOnce(routine);
      routineItemRepo.find.mockResolvedValueOnce([baseRoutineItem()]);
      exerciseRepo.find.mockResolvedValueOnce([baseExercise(EX_ID_1)]);

      const res = await service.findOne(TENANT_ID, ROUTINE_ID);

      expect(routinesRepo.findOne).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, id: ROUTINE_ID },
      });
      expect(routineItemRepo.find).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, routineId: ROUTINE_ID },
      });
      expect(res.items.length).toBe(1);
      expect(res.items[0]!.exercise.id).toBe(EX_ID_1);
    });

    it('no existe → 404 ROUTINE_NOT_FOUND', async () => {
      routinesRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.findOne(TENANT_ID, ROUTINE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('PATCH sólo name → update top-level, no toca items', async () => {
      routineRepo.findOne
        .mockResolvedValueOnce(baseRoutine())
        .mockResolvedValueOnce(baseRoutine({ name: 'Otro' }));
      routineItemRepo.find.mockResolvedValueOnce([baseRoutineItem()]);
      exerciseRepo.find.mockResolvedValueOnce([baseExercise(EX_ID_1)]);

      const dto: UpdateRoutineDto = { name: 'Otro' };
      const res = await service.update(TENANT_ID, ROUTINE_ID, dto);

      expect(routineRepo.update).toHaveBeenCalledWith(
        { id: ROUTINE_ID },
        { name: 'Otro' },
      );
      expect(routineItemRepo.delete).not.toHaveBeenCalled();
      expect(routineItemRepo.save).not.toHaveBeenCalled();
      expect(res.name).toBe('Otro');
    });

    it('PATCH con items → delete-then-insert + actualiza updatedAt', async () => {
      const routine = baseRoutine();
      routineRepo.findOne
        .mockResolvedValueOnce(routine)
        .mockResolvedValueOnce({ ...routine, updatedAt: new Date() });
      // `find` se llama dos veces: una en `loadAndAssertExercises` (validación
      // pre-insert) y otra en `loadExercisesMap` (build de la response).
      exerciseRepo.find
        .mockResolvedValueOnce([baseExercise(EX_ID_2)])
        .mockResolvedValueOnce([baseExercise(EX_ID_2)]);
      routineItemRepo.save.mockImplementationOnce(
        (items: Partial<RoutineItem>[]) =>
          Promise.resolve(
            items.map((i, idx) => ({
              ...baseRoutineItem(),
              ...i,
              id: `new-item-${idx + 1}`,
            })),
          ),
      );

      const dto: UpdateRoutineDto = {
        items: [
          {
            exerciseId: EX_ID_2,
            position: 1,
            prescribedSets: 4,
            prescribedReps: '8',
          },
        ],
      };
      const res = await service.update(TENANT_ID, ROUTINE_ID, dto);

      expect(routineItemRepo.delete).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        routineId: ROUTINE_ID,
      });
      expect(routineItemRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({
          exerciseId: EX_ID_2,
          position: 1,
        }),
      ]);
      // Update top-level no se llama (no había name/description en el DTO) pero sí el updatedAt explícito.
      const updateCalls = routineRepo.update.mock.calls as unknown[][];
      const hadUpdatedAt = updateCalls.some(
        (call) =>
          typeof call[1] === 'object' &&
          call[1] !== null &&
          'updatedAt' in (call[1] as Record<string, unknown>),
      );
      expect(hadUpdatedAt).toBe(true);
      expect(res.items[0]!.exerciseId).toBe(EX_ID_2);
    });

    it('no existe → 404', async () => {
      routineRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.update(TENANT_ID, ROUTINE_ID, { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
      expect(routineRepo.update).not.toHaveBeenCalled();
    });

    it('items con exerciseId fuera del tenant → 400 (rollback implícito por transacción)', async () => {
      routineRepo.findOne.mockResolvedValueOnce(baseRoutine());
      exerciseRepo.find.mockResolvedValueOnce([]); // no encontramos el exercise

      await expect(
        service.update(TENANT_ID, ROUTINE_ID, {
          items: [
            {
              exerciseId: EX_ID_2,
              position: 1,
              prescribedSets: 3,
              prescribedReps: '10',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(routineItemRepo.delete).not.toHaveBeenCalled();
      expect(routineItemRepo.save).not.toHaveBeenCalled();
    });

    it('items vacío en PATCH → DTO lo bloquea (caso defensivo: positions duplicadas también)', async () => {
      // El service rechaza dups antes de entrar a la transacción.
      await expect(
        service.update(TENANT_ID, ROUTINE_ID, {
          items: [
            {
              exerciseId: EX_ID_1,
              position: 1,
              prescribedSets: 3,
              prescribedReps: '10',
            },
            {
              exerciseId: EX_ID_2,
              position: 1,
              prescribedSets: 3,
              prescribedReps: '10',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('OK → delete por (tenantId, id)', async () => {
      routinesRepo.delete.mockResolvedValueOnce({ affected: 1 });
      await service.remove(TENANT_ID, ROUTINE_ID);
      expect(routinesRepo.delete).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        id: ROUTINE_ID,
      });
    });

    it('no existe → 404', async () => {
      routinesRepo.delete.mockResolvedValueOnce({ affected: 0 });
      await expect(service.remove(TENANT_ID, ROUTINE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
