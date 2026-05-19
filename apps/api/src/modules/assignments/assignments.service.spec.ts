import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import type { AuthenticatedUser } from '../auth/jwt-payload';
import { Routine } from '../routines/entities/routine.entity';
import { User } from '../users/entities/user.entity';
import { AssignmentsRepository } from './assignments.repository';
import { AssignmentsService } from './assignments.service';
import type { CreateAssignmentDto } from './dto/create-assignment.dto';
import { Assignment } from './entities/assignment.entity';

type AssignmentsRepoMock = {
  findOne: jest.Mock;
  find: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  delete: jest.Mock;
};

type RepoMock = {
  findOne: jest.Mock;
};

function makeAssignmentsRepo(): AssignmentsRepoMock {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
    create: jest.fn((input: unknown) => input),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
}

function makeRepo(): RepoMock {
  return {
    findOne: jest.fn(),
  };
}

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const OWNER_ID = '00000000-0000-0000-0000-000000000010';
const TRAINER_ID = '00000000-0000-0000-0000-000000000011';
const OTHER_TRAINER_ID = '00000000-0000-0000-0000-000000000012';
const STUDENT_ID = '00000000-0000-0000-0000-000000000020';
const ROUTINE_ID = '00000000-0000-0000-0000-0000000000a1';
const ASSIGNMENT_ID = '00000000-0000-0000-0000-0000000000b1';

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
function studentActor(): AuthenticatedUser {
  return {
    userId: STUDENT_ID,
    tenantId: TENANT_ID,
    role: 'STUDENT',
    isSuperadmin: false,
  };
}

function baseRoutine(overrides: Partial<Routine> = {}): Routine {
  const now = new Date('2026-05-18T10:00:00.000Z');
  return {
    id: ROUTINE_ID,
    tenantId: TENANT_ID,
    name: 'Tren superior',
    description: null,
    createdBy: TRAINER_ID,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function baseStudent(overrides: Partial<User> = {}): User {
  const now = new Date('2026-05-18T10:00:00.000Z');
  return {
    id: STUDENT_ID,
    tenantId: TENANT_ID,
    email: null,
    passwordHash: null,
    mustChangePassword: false,
    isSuperadmin: false,
    firstName: 'Estu',
    lastName: 'Diante',
    dni: '11111111',
    role: 'STUDENT',
    trainerId: TRAINER_ID,
    isActive: true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function baseAssignment(overrides: Partial<Assignment> = {}): Assignment {
  const now = new Date('2026-05-18T10:00:00.000Z');
  return {
    id: ASSIGNMENT_ID,
    tenantId: TENANT_ID,
    routineId: ROUTINE_ID,
    studentId: STUDENT_ID,
    assignedBy: TRAINER_ID,
    startsOn: '2026-05-18',
    endsOn: null,
    weekdayMask: 0b0101010, // Lun/Mié/Vie
    createdAt: now,
    ...overrides,
  };
}

function createDto(
  overrides: Partial<CreateAssignmentDto> = {},
): CreateAssignmentDto {
  return {
    studentId: STUDENT_ID,
    startsOn: '2026-05-18',
    weekdayMask: 0b0101010,
    ...overrides,
  };
}

describe('AssignmentsService', () => {
  let service: AssignmentsService;
  let assignmentsRepo: AssignmentsRepoMock;
  let routineRepo: RepoMock;
  let userRepo: RepoMock;

  const buildDataSource = (): DataSource => {
    const getRepository = jest.fn().mockImplementation((entity: unknown) => {
      if (entity === Routine) return routineRepo;
      if (entity === User) return userRepo;
      throw new Error(`Unexpected entity in getRepository: ${String(entity)}`);
    });
    return { getRepository } as unknown as DataSource;
  };

  beforeEach(async () => {
    assignmentsRepo = makeAssignmentsRepo();
    routineRepo = makeRepo();
    userRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        { provide: AssignmentsRepository, useValue: assignmentsRepo },
        { provide: DataSource, useValue: buildDataSource() },
      ],
    }).compile();
    service = module.get<AssignmentsService>(AssignmentsService);
  });

  describe('createForRoutine', () => {
    it('OWNER asigna a STUDENT del tenant → 201 con response', async () => {
      routineRepo.findOne.mockResolvedValueOnce(baseRoutine());
      userRepo.findOne.mockResolvedValueOnce(baseStudent());
      const saved = baseAssignment();
      assignmentsRepo.save.mockResolvedValueOnce(saved);

      const res = await service.createForRoutine(
        TENANT_ID,
        ownerActor(),
        ROUTINE_ID,
        createDto(),
      );

      expect(assignmentsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          routineId: ROUTINE_ID,
          studentId: STUDENT_ID,
          assignedBy: OWNER_ID,
          startsOn: '2026-05-18',
          endsOn: null,
          weekdayMask: 0b0101010,
        }),
      );
      expect(res.id).toBe(ASSIGNMENT_ID);
      expect(res.routineId).toBe(ROUTINE_ID);
      expect(res.studentId).toBe(STUDENT_ID);
      expect(res.status).toBeDefined();
    });

    it('TRAINER asigna a su propio STUDENT → OK', async () => {
      routineRepo.findOne.mockResolvedValueOnce(baseRoutine());
      userRepo.findOne.mockResolvedValueOnce(baseStudent());
      assignmentsRepo.save.mockResolvedValueOnce(baseAssignment());

      await expect(
        service.createForRoutine(
          TENANT_ID,
          trainerActor(),
          ROUTINE_ID,
          createDto(),
        ),
      ).resolves.toBeDefined();
    });

    it('TRAINER asigna a STUDENT de otro trainer → 403 FORBIDDEN_ROLE_HIERARCHY', async () => {
      routineRepo.findOne.mockResolvedValueOnce(baseRoutine());
      userRepo.findOne.mockResolvedValueOnce(
        baseStudent({ trainerId: OTHER_TRAINER_ID }),
      );

      await expect(
        service.createForRoutine(
          TENANT_ID,
          trainerActor(),
          ROUTINE_ID,
          createDto(),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(assignmentsRepo.save).not.toHaveBeenCalled();
    });

    it('routineId no existe → 404 ROUTINE_NOT_FOUND', async () => {
      routineRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.createForRoutine(
          TENANT_ID,
          ownerActor(),
          ROUTINE_ID,
          createDto(),
        ),
      ).rejects.toThrow(NotFoundException);
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('studentId no existe → 404 STUDENT_NOT_FOUND', async () => {
      routineRepo.findOne.mockResolvedValueOnce(baseRoutine());
      userRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.createForRoutine(
          TENANT_ID,
          ownerActor(),
          ROUTINE_ID,
          createDto(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('studentId es un TRAINER (no STUDENT) → 400 ASSIGNMENT_INVALID_STUDENT', async () => {
      routineRepo.findOne.mockResolvedValueOnce(baseRoutine());
      userRepo.findOne.mockResolvedValueOnce(
        baseStudent({ role: 'TRAINER', trainerId: null }),
      );
      await expect(
        service.createForRoutine(
          TENANT_ID,
          ownerActor(),
          ROUTINE_ID,
          createDto(),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('endsOn < startsOn → 400 ASSIGNMENT_INVALID_DATE_RANGE', async () => {
      await expect(
        service.createForRoutine(
          TENANT_ID,
          ownerActor(),
          ROUTINE_ID,
          createDto({ startsOn: '2026-05-18', endsOn: '2026-05-10' }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(routineRepo.findOne).not.toHaveBeenCalled();
    });

    it('endsOn === startsOn → OK (asignación de un solo día permitida)', async () => {
      routineRepo.findOne.mockResolvedValueOnce(baseRoutine());
      userRepo.findOne.mockResolvedValueOnce(baseStudent());
      assignmentsRepo.save.mockResolvedValueOnce(
        baseAssignment({ endsOn: '2026-05-18' }),
      );
      await expect(
        service.createForRoutine(
          TENANT_ID,
          ownerActor(),
          ROUTINE_ID,
          createDto({ endsOn: '2026-05-18' }),
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('listForStudent', () => {
    it('OWNER lista de cualquier STUDENT → todas', async () => {
      userRepo.findOne.mockResolvedValueOnce(baseStudent());
      assignmentsRepo.find.mockResolvedValueOnce([
        baseAssignment(),
        baseAssignment({
          id: 'b2',
          startsOn: '2026-01-01',
          endsOn: '2026-01-31',
        }),
      ]);

      const res = await service.listForStudent(
        TENANT_ID,
        ownerActor(),
        STUDENT_ID,
        {},
      );
      expect(res.length).toBe(2);
      expect(assignmentsRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, studentId: STUDENT_ID },
        }),
      );
    });

    it('TRAINER lista de su propio STUDENT → OK', async () => {
      userRepo.findOne.mockResolvedValueOnce(baseStudent());
      assignmentsRepo.find.mockResolvedValueOnce([]);
      await expect(
        service.listForStudent(TENANT_ID, trainerActor(), STUDENT_ID, {}),
      ).resolves.toEqual([]);
    });

    it('TRAINER lista de STUDENT de otro trainer → 403', async () => {
      userRepo.findOne.mockResolvedValueOnce(
        baseStudent({ trainerId: OTHER_TRAINER_ID }),
      );
      await expect(
        service.listForStudent(TENANT_ID, trainerActor(), STUDENT_ID, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('STUDENT lista lo suyo (id === actor.userId) → OK', async () => {
      userRepo.findOne.mockResolvedValueOnce(baseStudent());
      assignmentsRepo.find.mockResolvedValueOnce([baseAssignment()]);
      await expect(
        service.listForStudent(TENANT_ID, studentActor(), STUDENT_ID, {}),
      ).resolves.toHaveLength(1);
    });

    it('STUDENT mira a otro STUDENT → 403', async () => {
      userRepo.findOne.mockResolvedValueOnce(
        baseStudent({ id: 'other-student-id' }),
      );
      await expect(
        service.listForStudent(
          TENANT_ID,
          studentActor(),
          'other-student-id',
          {},
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('studentId apunta a un user que no es STUDENT → 404 STUDENT_NOT_FOUND', async () => {
      userRepo.findOne.mockResolvedValueOnce(
        baseStudent({ role: 'TRAINER', trainerId: null }),
      );
      await expect(
        service.listForStudent(TENANT_ID, ownerActor(), STUDENT_ID, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('filter status=active → sólo retorna activas', async () => {
      // Hoy es 2026-05-20 — fijamos via jest fake timer
      jest.useFakeTimers().setSystemTime(new Date('2026-05-20T10:00:00.000Z'));
      try {
        userRepo.findOne.mockResolvedValueOnce(baseStudent());
        assignmentsRepo.find.mockResolvedValueOnce([
          baseAssignment({
            id: 'a-active',
            startsOn: '2026-05-01',
            endsOn: null,
          }),
          baseAssignment({
            id: 'a-expired',
            startsOn: '2026-04-01',
            endsOn: '2026-04-30',
          }),
          baseAssignment({
            id: 'a-future',
            startsOn: '2026-06-01',
            endsOn: null,
          }),
        ]);

        const res = await service.listForStudent(
          TENANT_ID,
          ownerActor(),
          STUDENT_ID,
          { status: 'active' },
        );
        expect(res.length).toBe(1);
        expect(res[0]!.id).toBe('a-active');
        expect(res[0]!.status).toBe('active');
      } finally {
        jest.useRealTimers();
      }
    });

    it('filter status=expired', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-20T10:00:00.000Z'));
      try {
        userRepo.findOne.mockResolvedValueOnce(baseStudent());
        assignmentsRepo.find.mockResolvedValueOnce([
          baseAssignment({ id: 'a-active', startsOn: '2026-05-01' }),
          baseAssignment({
            id: 'a-expired',
            startsOn: '2026-04-01',
            endsOn: '2026-04-30',
          }),
        ]);
        const res = await service.listForStudent(
          TENANT_ID,
          ownerActor(),
          STUDENT_ID,
          { status: 'expired' },
        );
        expect(res.length).toBe(1);
        expect(res[0]!.status).toBe('expired');
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('removeByActor', () => {
    it('OWNER borra cualquier assignment del tenant → OK', async () => {
      assignmentsRepo.findOne.mockResolvedValueOnce(baseAssignment());
      await service.removeByActor(TENANT_ID, ownerActor(), ASSIGNMENT_ID);
      expect(assignmentsRepo.delete).toHaveBeenCalledWith({
        tenantId: TENANT_ID,
        id: ASSIGNMENT_ID,
      });
      // OWNER no consulta `users` (no necesita el chequeo de jerarquía).
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('TRAINER borra assignment de su propio STUDENT → OK', async () => {
      assignmentsRepo.findOne.mockResolvedValueOnce(baseAssignment());
      userRepo.findOne.mockResolvedValueOnce(baseStudent());
      await service.removeByActor(TENANT_ID, trainerActor(), ASSIGNMENT_ID);
      expect(assignmentsRepo.delete).toHaveBeenCalled();
    });

    it('TRAINER borra assignment de STUDENT de otro trainer → 403', async () => {
      assignmentsRepo.findOne.mockResolvedValueOnce(baseAssignment());
      userRepo.findOne.mockResolvedValueOnce(
        baseStudent({ trainerId: OTHER_TRAINER_ID }),
      );
      await expect(
        service.removeByActor(TENANT_ID, trainerActor(), ASSIGNMENT_ID),
      ).rejects.toThrow(ForbiddenException);
      expect(assignmentsRepo.delete).not.toHaveBeenCalled();
    });

    it('id no existe → 404 ASSIGNMENT_NOT_FOUND', async () => {
      assignmentsRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.removeByActor(TENANT_ID, ownerActor(), ASSIGNMENT_ID),
      ).rejects.toThrow(NotFoundException);
      expect(assignmentsRepo.delete).not.toHaveBeenCalled();
    });
  });
});
