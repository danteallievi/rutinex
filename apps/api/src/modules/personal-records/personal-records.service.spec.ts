import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';

import type { AuthenticatedUser } from '../auth/jwt-payload';
import { User } from '../users/entities/user.entity';
import type { PersonalRecord } from './entities/personal-record.entity';
import { PersonalRecordsRepository } from './personal-records.repository';
import { PersonalRecordsService } from './personal-records.service';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_TENANT_ID = '00000000-0000-0000-0000-000000000002';
const OWNER_ID = '00000000-0000-0000-0000-000000000010';
const TRAINER_ID = '00000000-0000-0000-0000-000000000011';
const OTHER_TRAINER_ID = '00000000-0000-0000-0000-000000000012';
const STUDENT_ID = '00000000-0000-0000-0000-000000000020';
const OTHER_STUDENT_ID = '00000000-0000-0000-0000-000000000021';
const EXERCISE_ID = '00000000-0000-0000-0000-0000000000e1';
const SET_ID = '00000000-0000-0000-0000-0000000000f1';

type RepoMock = {
  find: jest.Mock;
  findOne: jest.Mock;
};

function makeRepo(): RepoMock {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
  };
}

function ownerActor(): AuthenticatedUser {
  return {
    userId: OWNER_ID,
    tenantId: TENANT_ID,
    role: 'OWNER',
    isSuperadmin: false,
  };
}

function trainerActor(userId: string = TRAINER_ID): AuthenticatedUser {
  return {
    userId,
    tenantId: TENANT_ID,
    role: 'TRAINER',
    isSuperadmin: false,
  };
}

function studentActor(userId: string = STUDENT_ID): AuthenticatedUser {
  return {
    userId,
    tenantId: TENANT_ID,
    role: 'STUDENT',
    isSuperadmin: false,
  };
}

function basePr(overrides: Partial<PersonalRecord> = {}): PersonalRecord {
  return {
    id: '00000000-0000-0000-0000-0000000000aa',
    tenantId: TENANT_ID,
    studentId: STUDENT_ID,
    exerciseId: EXERCISE_ID,
    recordType: 'max_weight',
    weightKg: '100.00',
    reps: 5,
    achievedAt: new Date('2026-05-18T10:00:00Z'),
    setId: SET_ID,
    ...overrides,
  };
}

describe('PersonalRecordsService', () => {
  let service: PersonalRecordsService;
  let prRepo: RepoMock;
  let userRepo: RepoMock;

  beforeEach(async () => {
    prRepo = makeRepo();
    userRepo = makeRepo();

    const dataSource = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === User) return userRepo;
        throw new Error('Unexpected entity in test');
      }),
    } as unknown as DataSource;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonalRecordsService,
        { provide: PersonalRecordsRepository, useValue: prRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get<PersonalRecordsService>(PersonalRecordsService);
  });

  // ---------------------------------------------------------------------------
  // computeAndUpsertForSet
  // ---------------------------------------------------------------------------
  describe('computeAndUpsertForSet', () => {
    /**
     * Stub de EntityManager.query: capturamos las llamadas para chequear que
     * se ejecutan los 3 UPSERTs con los params esperados.
     */
    function buildManagerStub(): {
      manager: EntityManager;
      calls: Array<{ sql: string; params: unknown[] }>;
    } {
      const calls: Array<{ sql: string; params: unknown[] }> = [];
      const manager = {
        query: jest.fn((sql: string, params: unknown[]) => {
          calls.push({ sql, params });
          return Promise.resolve([]);
        }),
      } as unknown as EntityManager;
      return { manager, calls };
    }

    it('emite 3 UPSERTs (uno por record_type) con los params del set', async () => {
      const { manager, calls } = buildManagerStub();
      await service.computeAndUpsertForSet(manager, {
        tenantId: TENANT_ID,
        studentId: STUDENT_ID,
        exerciseId: EXERCISE_ID,
        setId: SET_ID,
        reps: 10,
        weightKg: 80,
      });

      expect(calls).toHaveLength(3);
      const types = calls.map((c) => c.params[3]);
      expect(types).toEqual(['max_weight', 'max_reps_at_weight', 'max_volume']);
      for (const call of calls) {
        expect(call.sql).toContain('INSERT INTO personal_records');
        expect(call.sql).toContain('ON CONFLICT');
        // weight serializado a string con 2 decimales.
        expect(call.params[4]).toBe('80.00');
        expect(call.params[5]).toBe(10);
        expect(call.params[6]).toBe(SET_ID);
      }
    });

    it('cada UPSERT usa el WHERE estricto correspondiente a su métrica', async () => {
      const { manager, calls } = buildManagerStub();
      await service.computeAndUpsertForSet(manager, {
        tenantId: TENANT_ID,
        studentId: STUDENT_ID,
        exerciseId: EXERCISE_ID,
        setId: SET_ID,
        reps: 8,
        weightKg: 100,
      });

      const byType = new Map(calls.map((c) => [c.params[3] as string, c.sql]));
      expect(byType.get('max_weight')).toContain(
        'personal_records.weight_kg < EXCLUDED.weight_kg',
      );
      expect(byType.get('max_reps_at_weight')).toContain(
        'personal_records.reps < EXCLUDED.reps',
      );
      expect(byType.get('max_volume')).toContain(
        '(personal_records.weight_kg * personal_records.reps) < (EXCLUDED.weight_kg * EXCLUDED.reps)',
      );
    });

    it('weightKg=null (bodyweight) → no se emite ningún UPSERT', async () => {
      const { manager, calls } = buildManagerStub();
      await service.computeAndUpsertForSet(manager, {
        tenantId: TENANT_ID,
        studentId: STUDENT_ID,
        exerciseId: EXERCISE_ID,
        setId: SET_ID,
        reps: 20,
        weightKg: null,
      });
      expect(calls).toHaveLength(0);
    });

    it('weightKg=0 (deload extremo) sí emite los 3 UPSERTs', async () => {
      // weight 0 no es null — el PR puede valer "0kg × 10 reps" como
      // baseline. La política excluye sólo el `null` (bodyweight).
      const { manager, calls } = buildManagerStub();
      await service.computeAndUpsertForSet(manager, {
        tenantId: TENANT_ID,
        studentId: STUDENT_ID,
        exerciseId: EXERCISE_ID,
        setId: SET_ID,
        reps: 10,
        weightKg: 0,
      });
      expect(calls).toHaveLength(3);
      for (const call of calls) {
        expect(call.params[4]).toBe('0.00');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // listByStudent
  // ---------------------------------------------------------------------------
  describe('listByStudent', () => {
    function studentRow(overrides: Partial<User> = {}): User {
      return {
        id: STUDENT_ID,
        tenantId: TENANT_ID,
        role: 'STUDENT',
        trainerId: TRAINER_ID,
        isActive: true,
        ...overrides,
      } as User;
    }

    it('OWNER lee PRs de cualquier student del tenant', async () => {
      userRepo.findOne.mockResolvedValueOnce(studentRow());
      prRepo.find.mockResolvedValueOnce([
        basePr(),
        basePr({ recordType: 'max_volume' }),
      ]);

      const res = await service.listByStudent(
        TENANT_ID,
        ownerActor(),
        STUDENT_ID,
      );
      expect(res).toHaveLength(2);
      expect(prRepo.find).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, studentId: STUDENT_ID },
        order: { exerciseId: 'ASC', recordType: 'ASC' },
      });
    });

    it('TRAINER lee PRs de su propio student', async () => {
      userRepo.findOne.mockResolvedValueOnce(studentRow());
      prRepo.find.mockResolvedValueOnce([basePr()]);
      const res = await service.listByStudent(
        TENANT_ID,
        trainerActor(),
        STUDENT_ID,
      );
      expect(res).toHaveLength(1);
    });

    it('TRAINER intenta leer PRs de un student de otro TRAINER → 403', async () => {
      userRepo.findOne.mockResolvedValueOnce(
        studentRow({ trainerId: OTHER_TRAINER_ID }),
      );
      await expect(
        service.listByStudent(TENANT_ID, trainerActor(), STUDENT_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('STUDENT lee sus propios PRs', async () => {
      userRepo.findOne.mockResolvedValueOnce(studentRow());
      prRepo.find.mockResolvedValueOnce([basePr()]);
      await service.listByStudent(TENANT_ID, studentActor(), STUDENT_ID);
      expect(prRepo.find).toHaveBeenCalled();
    });

    it('STUDENT intenta leer PRs de otro student → 403', async () => {
      userRepo.findOne.mockResolvedValueOnce(
        studentRow({ id: OTHER_STUDENT_ID }),
      );
      await expect(
        service.listByStudent(TENANT_ID, studentActor(), OTHER_STUDENT_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('studentId inexistente o cross-tenant → 404 STUDENT_NOT_FOUND', async () => {
      userRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.listByStudent(OTHER_TENANT_ID, ownerActor(), STUDENT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('userId existe en el tenant pero no es STUDENT → 404', async () => {
      // Un TRAINER con el mismo id no debe pasar el lookup como student.
      userRepo.findOne.mockResolvedValueOnce({
        id: STUDENT_ID,
        tenantId: TENANT_ID,
        role: 'TRAINER',
        trainerId: null,
      });
      await expect(
        service.listByStudent(TENANT_ID, ownerActor(), STUDENT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // listByStudentAndExercise
  // ---------------------------------------------------------------------------
  describe('listByStudentAndExercise', () => {
    it('OWNER lee PRs específicos del exercise', async () => {
      userRepo.findOne.mockResolvedValueOnce({
        id: STUDENT_ID,
        tenantId: TENANT_ID,
        role: 'STUDENT',
        trainerId: TRAINER_ID,
      });
      prRepo.find.mockResolvedValueOnce([basePr()]);
      const res = await service.listByStudentAndExercise(
        TENANT_ID,
        ownerActor(),
        STUDENT_ID,
        EXERCISE_ID,
      );
      expect(res).toHaveLength(1);
      expect(prRepo.find).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          studentId: STUDENT_ID,
          exerciseId: EXERCISE_ID,
        },
        order: { recordType: 'ASC' },
      });
    });

    it('Sin PRs (ejercicio sin sets calificados) → array vacío', async () => {
      userRepo.findOne.mockResolvedValueOnce({
        id: STUDENT_ID,
        tenantId: TENANT_ID,
        role: 'STUDENT',
        trainerId: TRAINER_ID,
      });
      prRepo.find.mockResolvedValueOnce([]);
      const res = await service.listByStudentAndExercise(
        TENANT_ID,
        ownerActor(),
        STUDENT_ID,
        EXERCISE_ID,
      );
      expect(res).toEqual([]);
    });

    it('STUDENT cross → 403', async () => {
      userRepo.findOne.mockResolvedValueOnce({
        id: OTHER_STUDENT_ID,
        tenantId: TENANT_ID,
        role: 'STUDENT',
        trainerId: TRAINER_ID,
      });
      await expect(
        service.listByStudentAndExercise(
          TENANT_ID,
          studentActor(),
          OTHER_STUDENT_ID,
          EXERCISE_ID,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
