import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import type { AuthenticatedUser } from '../auth/jwt-payload';
import { Assignment } from '../assignments/entities/assignment.entity';
import { Exercise } from '../exercises/entities/exercise.entity';
import { PersonalRecordsService } from '../personal-records/personal-records.service';
import { RoutineItem } from '../routines/entities/routine-item.entity';
import { Routine } from '../routines/entities/routine.entity';
import { User } from '../users/entities/user.entity';
import type { SessionRoutineSnapshot } from './dto/session-snapshot';
import { Session } from './entities/session.entity';
import { WorkoutSet } from './entities/set.entity';
import { SessionsRepository } from './sessions.repository';
import { SessionsService } from './sessions.service';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const OWNER_ID = '00000000-0000-0000-0000-000000000010';
const TRAINER_ID = '00000000-0000-0000-0000-000000000011';
const STUDENT_ID = '00000000-0000-0000-0000-000000000020';
const OTHER_STUDENT_ID = '00000000-0000-0000-0000-000000000021';
const ROUTINE_ID = '00000000-0000-0000-0000-0000000000a1';
const ASSIGNMENT_ID = '00000000-0000-0000-0000-0000000000b1';
const SESSION_ID = '00000000-0000-0000-0000-0000000000c1';
const ROUTINE_ITEM_ID = '00000000-0000-0000-0000-0000000000d1';
const EXERCISE_ID = '00000000-0000-0000-0000-0000000000e1';

type RepoMock = {
  findOne: jest.Mock;
  find: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function makeRepo(): RepoMock {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
    create: jest.fn((input: unknown) => input),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
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

function ownerActor(): AuthenticatedUser {
  return {
    userId: OWNER_ID,
    tenantId: TENANT_ID,
    role: 'OWNER',
    isSuperadmin: false,
  };
}

function trainerActor(): AuthenticatedUser {
  return {
    userId: TRAINER_ID,
    tenantId: TENANT_ID,
    role: 'TRAINER',
    isSuperadmin: false,
  };
}

function baseAssignment(overrides: Partial<Assignment> = {}): Assignment {
  const todayStr = (() => {
    const d = new Date();
    return `${String(d.getUTCFullYear())}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  })();
  return {
    id: ASSIGNMENT_ID,
    tenantId: TENANT_ID,
    routineId: ROUTINE_ID,
    studentId: STUDENT_ID,
    assignedBy: TRAINER_ID,
    startsOn: todayStr,
    endsOn: null,
    weekdayMask: 127,
    createdAt: new Date(),
    ...overrides,
  };
}

function baseRoutine(): Routine {
  const now = new Date();
  return {
    id: ROUTINE_ID,
    tenantId: TENANT_ID,
    name: 'Tren superior',
    description: null,
    createdBy: TRAINER_ID,
    createdAt: now,
    updatedAt: now,
  };
}

function baseRoutineItem(): RoutineItem {
  return {
    id: ROUTINE_ITEM_ID,
    tenantId: TENANT_ID,
    routineId: ROUTINE_ID,
    exerciseId: EXERCISE_ID,
    position: 1,
    prescribedSets: 3,
    prescribedReps: '10',
    prescribedWeight: null,
    restSeconds: null,
    notes: null,
  };
}

function baseExercise(): Exercise {
  const now = new Date();
  return {
    id: EXERCISE_ID,
    tenantId: TENANT_ID,
    title: 'Press de banca',
    description: '',
    mediaUrl: null,
    mediaType: 'none',
    muscleGroups: ['chest'],
    createdBy: TRAINER_ID,
    createdAt: now,
    updatedAt: now,
  };
}

function baseSnapshot(): SessionRoutineSnapshot {
  return {
    id: ROUTINE_ID,
    name: 'Tren superior',
    description: null,
    createdBy: TRAINER_ID,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: ROUTINE_ITEM_ID,
        exerciseId: EXERCISE_ID,
        position: 1,
        prescribedSets: 3,
        prescribedReps: '10',
        prescribedWeight: null,
        restSeconds: null,
        notes: null,
        exercise: {
          id: EXERCISE_ID,
          title: 'Press de banca',
          description: '',
          mediaUrl: null,
          mediaType: 'none',
          muscleGroups: ['chest'],
          createdBy: TRAINER_ID,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    ],
  };
}

function baseSession(overrides: Partial<Session> = {}): Session {
  return {
    id: SESSION_ID,
    tenantId: TENANT_ID,
    assignmentId: ASSIGNMENT_ID,
    routineId: ROUTINE_ID,
    studentId: STUDENT_ID,
    routineSnapshot: baseSnapshot(),
    startedAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}

describe('SessionsService', () => {
  let service: SessionsService;
  let sessionsRepo: RepoMock;
  let txRepos: {
    assignment: RepoMock;
    routine: RepoMock;
    routineItem: RepoMock;
    exercise: RepoMock;
    session: RepoMock;
    set: RepoMock;
    user: RepoMock;
  };

  const buildDataSource = (): DataSource => {
    const transaction = jest.fn((cb: (manager: unknown) => unknown) => {
      const manager = {
        getRepository: jest.fn().mockImplementation((entity: unknown) => {
          if (entity === Assignment) return txRepos.assignment;
          if (entity === Routine) return txRepos.routine;
          if (entity === RoutineItem) return txRepos.routineItem;
          if (entity === Exercise) return txRepos.exercise;
          if (entity === Session) return txRepos.session;
          if (entity === WorkoutSet) return txRepos.set;
          throw new Error(`Unexpected entity: ${String(entity)}`);
        }),
      };
      return cb(manager);
    });

    const getRepository = jest.fn().mockImplementation((entity: unknown) => {
      if (entity === Assignment) return txRepos.assignment;
      if (entity === Routine) return txRepos.routine;
      if (entity === RoutineItem) return txRepos.routineItem;
      if (entity === Exercise) return txRepos.exercise;
      if (entity === User) return txRepos.user;
      throw new Error(`Unexpected entity: ${String(entity)}`);
    });

    return {
      transaction,
      getRepository,
      manager: { getRepository },
    } as unknown as DataSource;
  };

  beforeEach(async () => {
    sessionsRepo = makeRepo();
    txRepos = {
      assignment: makeRepo(),
      routine: makeRepo(),
      routineItem: makeRepo(),
      exercise: makeRepo(),
      session: makeRepo(),
      set: makeRepo(),
      user: makeRepo(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: SessionsRepository, useValue: sessionsRepo },
        { provide: DataSource, useValue: buildDataSource() },
        {
          provide: PersonalRecordsService,
          useValue: {
            computeAndUpsertForSet: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();
    service = module.get<SessionsService>(SessionsService);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    it('STUDENT arranca sobre su propia asignación activa → snapshot + sets vacíos', async () => {
      txRepos.assignment.findOne.mockResolvedValueOnce(baseAssignment());
      txRepos.session.findOne
        .mockResolvedValueOnce(null) // open check
        .mockResolvedValueOnce(baseSession()); // refresh
      txRepos.routine.findOne.mockResolvedValueOnce(baseRoutine());
      txRepos.routineItem.find.mockResolvedValueOnce([baseRoutineItem()]);
      txRepos.exercise.find.mockResolvedValueOnce([baseExercise()]);
      txRepos.session.save.mockResolvedValueOnce(baseSession());

      const res = await service.create(TENANT_ID, studentActor(), {
        assignmentId: ASSIGNMENT_ID,
      });

      expect(res.assignmentId).toBe(ASSIGNMENT_ID);
      expect(res.routineId).toBe(ROUTINE_ID);
      expect(res.studentId).toBe(STUDENT_ID);
      expect(res.completedAt).toBeNull();
      expect(res.sets).toEqual([]);
      expect(res.routineSnapshot.items).toHaveLength(1);
      expect(res.routineSnapshot.items[0]!.exercise.title).toBe(
        'Press de banca',
      );
      expect(txRepos.session.save).toHaveBeenCalled();
    });

    it('assignmentId no existe → 404 ASSIGNMENT_NOT_FOUND', async () => {
      txRepos.assignment.findOne.mockResolvedValueOnce(null);
      await expect(
        service.create(TENANT_ID, studentActor(), {
          assignmentId: ASSIGNMENT_ID,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('STUDENT arranca sobre asignación de otro student → 403 FORBIDDEN_ROLE_HIERARCHY', async () => {
      txRepos.assignment.findOne.mockResolvedValueOnce(
        baseAssignment({ studentId: OTHER_STUDENT_ID }),
      );
      await expect(
        service.create(TENANT_ID, studentActor(), {
          assignmentId: ASSIGNMENT_ID,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Asignación expirada → 400 ASSIGNMENT_NOT_ACTIVE', async () => {
      txRepos.assignment.findOne.mockResolvedValueOnce(
        baseAssignment({ startsOn: '1999-01-01', endsOn: '1999-12-31' }),
      );
      await expect(
        service.create(TENANT_ID, studentActor(), {
          assignmentId: ASSIGNMENT_ID,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Asignación futura → 400 ASSIGNMENT_NOT_ACTIVE', async () => {
      txRepos.assignment.findOne.mockResolvedValueOnce(
        baseAssignment({ startsOn: '2099-01-01' }),
      );
      await expect(
        service.create(TENANT_ID, studentActor(), {
          assignmentId: ASSIGNMENT_ID,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Ya hay una sesión abierta para esta asignación → 409 SESSION_ALREADY_OPEN', async () => {
      txRepos.assignment.findOne.mockResolvedValueOnce(baseAssignment());
      txRepos.session.findOne.mockResolvedValueOnce(baseSession());
      await expect(
        service.create(TENANT_ID, studentActor(), {
          assignmentId: ASSIGNMENT_ID,
        }),
      ).rejects.toThrow(ConflictException);
      expect(txRepos.session.save).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // addSet
  // ---------------------------------------------------------------------------
  describe('addSet', () => {
    it('STUDENT carga set en su sesión abierta → OK con set en la response', async () => {
      txRepos.session.findOne.mockResolvedValueOnce(baseSession());
      txRepos.set.findOne.mockResolvedValueOnce(null); // no duplicate
      txRepos.set.save.mockResolvedValueOnce({
        id: 'set-1',
        tenantId: TENANT_ID,
        sessionId: SESSION_ID,
        routineItemId: ROUTINE_ITEM_ID,
        exerciseId: EXERCISE_ID,
        studentId: STUDENT_ID,
        setNumber: 1,
        reps: 10,
        weightKg: '60.00',
        createdAt: new Date(),
      });
      txRepos.set.find.mockResolvedValueOnce([
        {
          id: 'set-1',
          tenantId: TENANT_ID,
          sessionId: SESSION_ID,
          routineItemId: ROUTINE_ITEM_ID,
          exerciseId: EXERCISE_ID,
          studentId: STUDENT_ID,
          setNumber: 1,
          reps: 10,
          weightKg: '60.00',
          createdAt: new Date(),
        },
      ]);

      const res = await service.addSet(TENANT_ID, studentActor(), SESSION_ID, {
        routineItemId: ROUTINE_ITEM_ID,
        setNumber: 1,
        reps: 10,
        weightKg: 60,
      });

      expect(res.sets).toHaveLength(1);
      expect(res.sets[0]!.reps).toBe(10);
      expect(res.sets[0]!.weightKg).toBe(60);
      expect(txRepos.set.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          sessionId: SESSION_ID,
          routineItemId: ROUTINE_ITEM_ID,
          exerciseId: EXERCISE_ID,
          studentId: STUDENT_ID,
          setNumber: 1,
          reps: 10,
          weightKg: '60.00',
        }),
      );
    });

    it('weightKg=null → set bodyweight', async () => {
      txRepos.session.findOne.mockResolvedValueOnce(baseSession());
      txRepos.set.findOne.mockResolvedValueOnce(null);
      txRepos.set.save.mockResolvedValueOnce({});
      txRepos.set.find.mockResolvedValueOnce([]);

      await service.addSet(TENANT_ID, studentActor(), SESSION_ID, {
        routineItemId: ROUTINE_ITEM_ID,
        setNumber: 1,
        reps: 12,
        weightKg: null,
      });

      expect(txRepos.set.save).toHaveBeenCalledWith(
        expect.objectContaining({ weightKg: null }),
      );
    });

    it('sessionId no existe → 404 SESSION_NOT_FOUND', async () => {
      txRepos.session.findOne.mockResolvedValueOnce(null);
      await expect(
        service.addSet(TENANT_ID, studentActor(), SESSION_ID, {
          routineItemId: ROUTINE_ITEM_ID,
          setNumber: 1,
          reps: 10,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('STUDENT carga set en sesión de otro student → 403', async () => {
      txRepos.session.findOne.mockResolvedValueOnce(
        baseSession({ studentId: OTHER_STUDENT_ID }),
      );
      await expect(
        service.addSet(TENANT_ID, studentActor(), SESSION_ID, {
          routineItemId: ROUTINE_ITEM_ID,
          setNumber: 1,
          reps: 10,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Sesión ya completada → 400 SESSION_ALREADY_COMPLETED', async () => {
      txRepos.session.findOne.mockResolvedValueOnce(
        baseSession({ completedAt: new Date() }),
      );
      await expect(
        service.addSet(TENANT_ID, studentActor(), SESSION_ID, {
          routineItemId: ROUTINE_ITEM_ID,
          setNumber: 1,
          reps: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('routineItemId no pertenece al snapshot → 400 SET_INVALID_ROUTINE_ITEM', async () => {
      txRepos.session.findOne.mockResolvedValueOnce(baseSession());
      await expect(
        service.addSet(TENANT_ID, studentActor(), SESSION_ID, {
          routineItemId: 'foreign-uuid',
          setNumber: 1,
          reps: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('setNumber duplicado para (session, routine_item) → 409 SET_NUMBER_DUPLICATED', async () => {
      txRepos.session.findOne.mockResolvedValueOnce(baseSession());
      txRepos.set.findOne.mockResolvedValueOnce({ id: 'pre-existing' });
      await expect(
        service.addSet(TENANT_ID, studentActor(), SESSION_ID, {
          routineItemId: ROUTINE_ITEM_ID,
          setNumber: 1,
          reps: 10,
        }),
      ).rejects.toThrow(ConflictException);
      expect(txRepos.set.save).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // complete
  // ---------------------------------------------------------------------------
  describe('complete', () => {
    it('STUDENT completa su sesión → completedAt seteado', async () => {
      const s = baseSession();
      txRepos.session.findOne.mockResolvedValueOnce(s);
      txRepos.set.find.mockResolvedValueOnce([]);
      const res = await service.complete(TENANT_ID, studentActor(), SESSION_ID);
      expect(res.completedAt).not.toBeNull();
      expect(txRepos.session.update).toHaveBeenCalledWith(
        { id: SESSION_ID },
        expect.objectContaining({ completedAt: expect.any(Date) as Date }),
      );
    });

    it('sessionId inexistente → 404', async () => {
      txRepos.session.findOne.mockResolvedValueOnce(null);
      await expect(
        service.complete(TENANT_ID, studentActor(), SESSION_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('STUDENT completa sesión de otro student → 403', async () => {
      txRepos.session.findOne.mockResolvedValueOnce(
        baseSession({ studentId: OTHER_STUDENT_ID }),
      );
      await expect(
        service.complete(TENANT_ID, studentActor(), SESSION_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Sesión ya completada → 400 SESSION_ALREADY_COMPLETED', async () => {
      txRepos.session.findOne.mockResolvedValueOnce(
        baseSession({ completedAt: new Date() }),
      );
      await expect(
        service.complete(TENANT_ID, studentActor(), SESSION_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // list — sólo verificamos jerarquía (la mecánica de QB no se puede mockear
  // razonablemente sin reinventar TypeORM, así que el cursor + ordenamiento
  // queda cubierto por los E2E).
  // ---------------------------------------------------------------------------
  describe('list — jerarquía', () => {
    it('STUDENT pide ?studentId distinto → 403', async () => {
      await expect(
        service.list(TENANT_ID, studentActor(), {
          studentId: OTHER_STUDENT_ID,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TRAINER pide ?studentId de un student que no es propio → 403', async () => {
      txRepos.user.findOne.mockResolvedValueOnce({
        id: STUDENT_ID,
        tenantId: TENANT_ID,
        role: 'STUDENT',
        trainerId: 'another-trainer-id',
      });
      await expect(
        service.list(TENANT_ID, trainerActor(), { studentId: STUDENT_ID }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('OWNER sin filtros → no aplica restricción extra (QB se construye)', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      sessionsRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const res = await service.list(TENANT_ID, ownerActor(), {});
      expect(res.data).toEqual([]);
      expect(res.nextCursor).toBeNull();
      // OWNER sin studentId: no se llama userRepo.findOne (no necesita validar).
      expect(txRepos.user.findOne).not.toHaveBeenCalled();
    });
  });
});
