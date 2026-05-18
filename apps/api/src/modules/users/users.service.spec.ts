import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IsNull } from 'typeorm';

import type { AuthenticatedUser } from '../auth/jwt-payload';
import { PasswordService } from '../auth/password.service';
import { User, UserRole } from './entities/user.entity';
import { UsersRepository } from './users.repository';
import { CreateUserInput, UsersService } from './users.service';

type MockRepo = {
  findOne: jest.Mock;
  findOneAcrossTenants: jest.Mock;
  findAndCount: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
  updateAcrossTenants: jest.Mock;
};

function makeMockRepo(): MockRepo {
  const now = new Date('2026-05-17T10:00:00.000Z');
  return {
    findOne: jest.fn(),
    findOneAcrossTenants: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn((input: Partial<User>) => input as User),
    save: jest.fn((input: User) =>
      Promise.resolve({
        ...input,
        id: 'new-id',
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null,
      } as User),
    ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    updateAcrossTenants: jest.fn(),
  };
}

type MockPasswordService = {
  generate: jest.Mock;
  hash: jest.Mock;
  verify: jest.Mock;
};

function makeMockPasswordService(): MockPasswordService {
  return {
    generate: jest.fn(() => 'generated-plain-16'),
    hash: jest.fn((plain: string) => Promise.resolve(`hashed:${plain}`)),
    verify: jest.fn(),
  };
}

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_TENANT_ID = '00000000-0000-0000-0000-000000000002';

function staffInput(overrides: Partial<CreateUserInput> = {}): CreateUserInput {
  return {
    tenantId: TENANT_ID,
    role: 'OWNER',
    email: 'owner@example.com',
    passwordHash: 'argon2-hash',
    firstName: 'Ada',
    lastName: 'Lovelace',
    mustChangePassword: true,
    ...overrides,
  };
}

function studentInput(
  overrides: Partial<CreateUserInput> = {},
): CreateUserInput {
  return {
    tenantId: TENANT_ID,
    role: 'STUDENT' satisfies UserRole,
    dni: '12345678',
    firstName: 'Juan',
    lastName: 'Pérez',
    ...overrides,
  };
}

function superadminInput(
  overrides: Partial<CreateUserInput> = {},
): CreateUserInput {
  return {
    tenantId: null,
    role: null,
    isSuperadmin: true,
    email: 'super@rutinex.app',
    passwordHash: 'argon2-hash',
    firstName: 'Super',
    lastName: 'Admin',
    ...overrides,
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let repo: MockRepo;
  let passwordService: MockPasswordService;

  beforeEach(async () => {
    repo = makeMockRepo();
    passwordService = makeMockPasswordService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repo },
        { provide: PasswordService, useValue: passwordService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('helpers', () => {
    it('findByEmailAndTenant filtra por (tenantId, email) excluyendo SUPERADMINs', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await service.findByEmailAndTenant(TENANT_ID, 'owner@example.com');
      expect(repo.findOne).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          email: 'owner@example.com',
          isSuperadmin: false,
        },
      });
    });

    it('findSuperadminByEmail matchea el índice parcial (tenantId IS NULL + isSuperadmin=true)', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await service.findSuperadminByEmail('super@rutinex.app');
      expect(repo.findOne).toHaveBeenCalledWith({
        where: {
          email: 'super@rutinex.app',
          tenantId: IsNull(),
          isSuperadmin: true,
        },
      });
    });

    it('findStudentByDniAndTenant filtra por (tenantId, dni, role=STUDENT)', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await service.findStudentByDniAndTenant(TENANT_ID, '12345678');
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, dni: '12345678', role: 'STUDENT' },
      });
    });

    it('findById usa el escape hatch findOneAcrossTenants (cross-tenant explícito)', async () => {
      repo.findOneAcrossTenants.mockResolvedValueOnce(null);
      await service.findById('user-id');
      expect(repo.findOneAcrossTenants).toHaveBeenCalledWith({
        where: { id: 'user-id' },
      });
      expect(repo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('create — SUPERADMIN', () => {
    it('crea un SUPERADMIN con tenant_id=NULL y role=NULL', async () => {
      repo.findOne.mockResolvedValueOnce(null);

      const created = await service.create(superadminInput());

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: null,
          role: null,
          isSuperadmin: true,
          email: 'super@rutinex.app',
          passwordHash: 'argon2-hash',
          mustChangePassword: false,
          isActive: true,
        }),
      );
      expect(created.isSuperadmin).toBe(true);
    });

    it('rechaza si llega con tenant_id (SUPERADMIN no pertenece a tenant)', async () => {
      await expect(
        service.create(superadminInput({ tenantId: TENANT_ID })),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rechaza si llega con role', async () => {
      await expect(
        service.create(superadminInput({ role: 'OWNER' })),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rechaza si falta password_hash', async () => {
      await expect(
        service.create(superadminInput({ passwordHash: undefined })),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si falta email', async () => {
      await expect(
        service.create(superadminInput({ email: undefined })),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si llega con DNI', async () => {
      await expect(
        service.create(superadminInput({ dni: '12345678' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza con ConflictException si ya existe un SUPERADMIN con ese email', async () => {
      const existing = { id: 'existing-id' } as User;
      repo.findOne.mockResolvedValueOnce(existing);

      await expect(service.create(superadminInput())).rejects.toThrow(
        ConflictException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('create — STAFF (OWNER/TRAINER)', () => {
    it('crea un OWNER con must_change_password=true', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await service.create(staffInput());

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          role: 'OWNER',
          isSuperadmin: false,
          email: 'owner@example.com',
          passwordHash: 'argon2-hash',
          mustChangePassword: true,
          isActive: true,
        }),
      );
    });

    it('crea un TRAINER bajo un tenant', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await service.create(
        staffInput({ role: 'TRAINER', email: 'trainer@example.com' }),
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'TRAINER',
          email: 'trainer@example.com',
        }),
      );
    });

    it('rechaza si falta tenant_id', async () => {
      await expect(
        service.create(staffInput({ tenantId: null })),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si falta email', async () => {
      await expect(
        service.create(staffInput({ email: undefined })),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si falta password_hash', async () => {
      await expect(
        service.create(staffInput({ passwordHash: undefined })),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si llega con DNI (no aplica a OWNER/TRAINER en MVP)', async () => {
      await expect(
        service.create(staffInput({ dni: '12345678' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza con ConflictException si (tenant_id, email) ya existe', async () => {
      const existing = { id: 'existing-id' } as User;
      repo.findOne.mockResolvedValueOnce(existing);

      await expect(service.create(staffInput())).rejects.toThrow(
        ConflictException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('permite el mismo email en otro tenant (UNIQUE compuesto, no global)', async () => {
      repo.findOne.mockImplementation(
        ({ where }: { where: { tenantId: string } }) =>
          Promise.resolve(
            where.tenantId === TENANT_ID ? ({ id: 'taken' } as User) : null,
          ),
      );

      await expect(service.create(staffInput())).rejects.toThrow(
        ConflictException,
      );
      await expect(
        service.create(staffInput({ tenantId: OTHER_TENANT_ID })),
      ).resolves.toBeDefined();
    });
  });

  describe('create — STUDENT', () => {
    it('crea un STUDENT con password_hash=NULL y DNI presente', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await service.create(studentInput({ trainerId: 'trainer-uuid' }));

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          role: 'STUDENT',
          isSuperadmin: false,
          dni: '12345678',
          passwordHash: null,
          mustChangePassword: false,
          trainerId: 'trainer-uuid',
          isActive: true,
        }),
      );
    });

    it('rechaza si falta tenant_id', async () => {
      await expect(
        service.create(studentInput({ tenantId: null })),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si falta DNI', async () => {
      await expect(
        service.create(studentInput({ dni: undefined })),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si llega con password_hash (login es por DNI, ver ADR-014)', async () => {
      await expect(
        service.create(studentInput({ passwordHash: 'argon2-hash' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza con ConflictException si (tenant_id, dni) ya existe', async () => {
      const existing = { id: 'existing-id' } as User;
      repo.findOne.mockResolvedValueOnce(existing);

      await expect(service.create(studentInput())).rejects.toThrow(
        ConflictException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('permite el mismo DNI en otro tenant (UNIQUE compuesto, no global)', async () => {
      repo.findOne.mockImplementation(
        ({ where }: { where: { tenantId: string } }) =>
          Promise.resolve(
            where.tenantId === TENANT_ID ? ({ id: 'taken' } as User) : null,
          ),
      );

      await expect(service.create(studentInput())).rejects.toThrow(
        ConflictException,
      );
      await expect(
        service.create(studentInput({ tenantId: OTHER_TENANT_ID })),
      ).resolves.toBeDefined();
    });
  });

  describe('create — invalid combinations', () => {
    it('rechaza si no es SUPERADMIN ni tiene role válido', async () => {
      await expect(
        service.create({
          tenantId: TENANT_ID,
          role: null,
          email: 'foo@example.com',
          passwordHash: 'hash',
          firstName: 'F',
          lastName: 'L',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('setActive', () => {
    it('actualiza is_active vía escape hatch (update por id global)', async () => {
      repo.updateAcrossTenants.mockResolvedValueOnce({ affected: 1 });
      await service.setActive('user-id', false);
      expect(repo.updateAcrossTenants).toHaveBeenCalledWith(
        { id: 'user-id' },
        { isActive: false },
      );
    });

    it('tira NotFoundException si no afecta filas', async () => {
      repo.updateAcrossTenants.mockResolvedValueOnce({ affected: 0 });
      await expect(service.setActive('missing', true)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setMustChangePassword', () => {
    it('actualiza el flag vía escape hatch', async () => {
      repo.updateAcrossTenants.mockResolvedValueOnce({ affected: 1 });
      await service.setMustChangePassword('user-id', false);
      expect(repo.updateAcrossTenants).toHaveBeenCalledWith(
        { id: 'user-id' },
        { mustChangePassword: false },
      );
    });

    it('tira NotFoundException si no afecta filas', async () => {
      repo.updateAcrossTenants.mockResolvedValueOnce({ affected: 0 });
      await expect(
        service.setMustChangePassword('missing', true),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setPassword', () => {
    it('actualiza password_hash + must_change_password=false en una sola sentencia', async () => {
      repo.updateAcrossTenants.mockResolvedValueOnce({ affected: 1 });
      await service.setPassword('user-id', 'nuevo-hash');
      expect(repo.updateAcrossTenants).toHaveBeenCalledWith(
        { id: 'user-id' },
        { passwordHash: 'nuevo-hash', mustChangePassword: false },
      );
    });

    it('tira NotFoundException si no afecta filas', async () => {
      repo.updateAcrossTenants.mockResolvedValueOnce({ affected: 0 });
      await expect(service.setPassword('missing', 'hash')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================================
  // Step 12 — CRUD users del tenant
  // ============================================================================

  const ownerActor: AuthenticatedUser = {
    userId: 'owner-uuid',
    tenantId: TENANT_ID,
    role: 'OWNER',
    isSuperadmin: false,
  };
  const trainerActor: AuthenticatedUser = {
    userId: 'trainer-uuid',
    tenantId: TENANT_ID,
    role: 'TRAINER',
    isSuperadmin: false,
  };

  describe('createByActor — TRAINER (alta por OWNER)', () => {
    it('genera password, hashea y crea TRAINER con must_change_password=true', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      const result = await service.createByActor(TENANT_ID, ownerActor, {
        role: 'TRAINER',
        email: 'nuevo@trainer.test',
        firstName: 'Nuevo',
        lastName: 'Trainer',
      });

      expect(passwordService.generate).toHaveBeenCalledTimes(1);
      expect(passwordService.hash).toHaveBeenCalledWith('generated-plain-16');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          role: 'TRAINER',
          email: 'nuevo@trainer.test',
          passwordHash: 'hashed:generated-plain-16',
          mustChangePassword: true,
          trainerId: null,
        }),
      );
      expect(result.generatedPassword).toBe('generated-plain-16');
      expect(result.user.role).toBe('TRAINER');
      expect(result.user.mustChangePassword).toBe(true);
    });

    it('TRAINER actor → 403 FORBIDDEN_ROLE_HIERARCHY', async () => {
      await expect(
        service.createByActor(TENANT_ID, trainerActor, {
          role: 'TRAINER',
          email: 'x@x.test',
          firstName: 'X',
          lastName: 'Y',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('OWNER sin email → 400 STAFF_EMAIL_REQUIRED', async () => {
      await expect(
        service.createByActor(TENANT_ID, ownerActor, {
          role: 'TRAINER',
          firstName: 'X',
          lastName: 'Y',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('OWNER con dni en TRAINER → 400 STAFF_NO_DNI', async () => {
      await expect(
        service.createByActor(TENANT_ID, ownerActor, {
          role: 'TRAINER',
          email: 'x@x.test',
          dni: '12345',
          firstName: 'X',
          lastName: 'Y',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createByActor — STUDENT (alta por TRAINER)', () => {
    it('crea STUDENT con trainerId = actor.userId, sin password', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      const result = await service.createByActor(TENANT_ID, trainerActor, {
        role: 'STUDENT',
        dni: '99887766',
        firstName: 'Estu',
        lastName: 'Diante',
      });

      expect(passwordService.generate).not.toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          role: 'STUDENT',
          dni: '99887766',
          passwordHash: null,
          trainerId: 'trainer-uuid',
          mustChangePassword: false,
        }),
      );
      expect(result.generatedPassword).toBeUndefined();
      expect(result.user.trainerId).toBe('trainer-uuid');
    });

    it('OWNER actor → 403 FORBIDDEN_ROLE_HIERARCHY (OWNER no crea STUDENT en MVP)', async () => {
      await expect(
        service.createByActor(TENANT_ID, ownerActor, {
          role: 'STUDENT',
          dni: '12345678',
          firstName: 'X',
          lastName: 'Y',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TRAINER sin dni → 400 STUDENT_DNI_REQUIRED', async () => {
      await expect(
        service.createByActor(TENANT_ID, trainerActor, {
          role: 'STUDENT',
          firstName: 'X',
          lastName: 'Y',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listForActor', () => {
    it('OWNER → filtra por tenantId solamente (ve todo el tenant)', async () => {
      repo.findAndCount.mockResolvedValueOnce([[], 0]);
      await service.listForActor(TENANT_ID, ownerActor, {
        page: 1,
        pageSize: 20,
      });
      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('OWNER → propaga filtros role e isActive', async () => {
      repo.findAndCount.mockResolvedValueOnce([[], 0]);
      await service.listForActor(TENANT_ID, ownerActor, {
        role: 'TRAINER',
        isActive: true,
        page: 2,
        pageSize: 10,
      });
      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, role: 'TRAINER', isActive: true },
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 10,
      });
    });

    it('TRAINER → query con dos ramas (sus students + self), ambas filtran por tenant', async () => {
      repo.findAndCount.mockResolvedValueOnce([[], 0]);
      await service.listForActor(TENANT_ID, trainerActor, {
        page: 1,
        pageSize: 20,
      });
      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: [
          { tenantId: TENANT_ID, trainerId: 'trainer-uuid' },
          { tenantId: TENANT_ID, id: 'trainer-uuid' },
        ],
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('mapea las filas a UserResponse (sin password_hash)', async () => {
      const now = new Date('2026-05-17T10:00:00.000Z');
      repo.findAndCount.mockResolvedValueOnce([
        [
          {
            id: 'u1',
            tenantId: TENANT_ID,
            role: 'TRAINER',
            email: 't@x.test',
            dni: null,
            firstName: 'T',
            lastName: 'X',
            trainerId: null,
            isActive: true,
            mustChangePassword: false,
            isSuperadmin: false,
            lastLoginAt: null,
            createdAt: now,
            updatedAt: now,
            passwordHash: 'secret-hash',
          } as User,
        ],
        1,
      ]);
      const res = await service.listForActor(TENANT_ID, ownerActor, {
        page: 1,
        pageSize: 20,
      });
      expect(res.total).toBe(1);
      const first = res.data[0]!;
      expect(first.email).toBe('t@x.test');
      expect(Object.prototype.hasOwnProperty.call(first, 'passwordHash')).toBe(
        false,
      );
    });
  });

  describe('updateForActor', () => {
    const target = (overrides: Partial<User>): User => ({
      id: 'target-uuid',
      tenantId: TENANT_ID,
      role: 'STUDENT',
      email: null,
      dni: '12345',
      firstName: 'A',
      lastName: 'B',
      trainerId: 'trainer-uuid',
      isActive: true,
      mustChangePassword: false,
      isSuperadmin: false,
      lastLoginAt: null,
      passwordHash: null,
      createdAt: new Date('2026-05-17'),
      updatedAt: new Date('2026-05-17'),
      ...overrides,
    });

    it('OWNER puede actualizar cualquier user del tenant', async () => {
      repo.findOne.mockResolvedValueOnce(target({ role: 'TRAINER' }));
      const res = await service.updateForActor(
        TENANT_ID,
        ownerActor,
        'target-uuid',
        { firstName: 'Nuevo', isActive: false },
      );
      expect(repo.update).toHaveBeenCalledWith(
        { tenantId: TENANT_ID, id: 'target-uuid' },
        { firstName: 'Nuevo', isActive: false },
      );
      expect(res.deactivated).toBe(true);
      expect(res.response.firstName).toBe('Nuevo');
    });

    it('TRAINER puede actualizar a sus propios STUDENTS', async () => {
      repo.findOne.mockResolvedValueOnce(target({}));
      await service.updateForActor(TENANT_ID, trainerActor, 'target-uuid', {
        firstName: 'Modificado',
      });
      expect(repo.update).toHaveBeenCalled();
    });

    it('TRAINER puede actualizarse a sí mismo', async () => {
      repo.findOne.mockResolvedValueOnce(
        target({ id: 'trainer-uuid', role: 'TRAINER' }),
      );
      await service.updateForActor(TENANT_ID, trainerActor, 'trainer-uuid', {
        firstName: 'Yo Mismo',
      });
      expect(repo.update).toHaveBeenCalled();
    });

    it('TRAINER NO puede actualizar STUDENT de otro TRAINER → 403', async () => {
      repo.findOne.mockResolvedValueOnce(
        target({ trainerId: 'otro-trainer-uuid' }),
      );
      await expect(
        service.updateForActor(TENANT_ID, trainerActor, 'target-uuid', {
          firstName: 'X',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TRAINER NO puede actualizar al OWNER → 403', async () => {
      repo.findOne.mockResolvedValueOnce(
        target({ role: 'OWNER', trainerId: null }),
      );
      await expect(
        service.updateForActor(TENANT_ID, trainerActor, 'target-uuid', {
          firstName: 'X',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('user inexistente → 404 USER_NOT_FOUND', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.updateForActor(TENANT_ID, ownerActor, 'no-existe', {
          firstName: 'X',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deactivated=false si se activa o se queda igual', async () => {
      repo.findOne.mockResolvedValueOnce(target({ isActive: false }));
      const res = await service.updateForActor(
        TENANT_ID,
        ownerActor,
        'target-uuid',
        { isActive: true },
      );
      expect(res.deactivated).toBe(false);
    });
  });

  describe('removeForActor', () => {
    const target = (overrides: Partial<User>): User =>
      ({
        id: 'target-uuid',
        tenantId: TENANT_ID,
        role: 'STUDENT',
        ...overrides,
      }) as User;

    it('soft delete (isActive=false) sobre TRAINER funciona', async () => {
      repo.findOne.mockResolvedValueOnce(target({ role: 'TRAINER' }));
      await service.removeForActor(TENANT_ID, ownerActor, 'target-uuid');
      expect(repo.update).toHaveBeenCalledWith(
        { tenantId: TENANT_ID, id: 'target-uuid' },
        { isActive: false },
      );
    });

    it('OWNER target → 403 (no se borran OWNERs desde acá)', async () => {
      repo.findOne.mockResolvedValueOnce(target({ role: 'OWNER' }));
      await expect(
        service.removeForActor(TENANT_ID, ownerActor, 'target-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('user inexistente → 404', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.removeForActor(TENANT_ID, ownerActor, 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resetTrainerPassword', () => {
    const target = (overrides: Partial<User>): User =>
      ({
        id: 'trainer-uuid',
        tenantId: TENANT_ID,
        role: 'TRAINER',
        ...overrides,
      }) as User;

    it('genera password, hashea, persiste con must_change_password=true', async () => {
      repo.findOne.mockResolvedValueOnce(target({}));
      const res = await service.resetTrainerPassword(TENANT_ID, 'trainer-uuid');
      expect(passwordService.generate).toHaveBeenCalled();
      expect(passwordService.hash).toHaveBeenCalledWith('generated-plain-16');
      expect(repo.update).toHaveBeenCalledWith(
        { tenantId: TENANT_ID, id: 'trainer-uuid' },
        {
          passwordHash: 'hashed:generated-plain-16',
          mustChangePassword: true,
        },
      );
      expect(res.generatedPassword).toBe('generated-plain-16');
    });

    it('STUDENT target → 400 USER_NO_PASSWORD', async () => {
      repo.findOne.mockResolvedValueOnce(target({ role: 'STUDENT' }));
      await expect(
        service.resetTrainerPassword(TENANT_ID, 'trainer-uuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('OWNER target → 403 FORBIDDEN_ROLE_HIERARCHY', async () => {
      repo.findOne.mockResolvedValueOnce(target({ role: 'OWNER' }));
      await expect(
        service.resetTrainerPassword(TENANT_ID, 'trainer-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('inexistente → 404', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.resetTrainerPassword(TENANT_ID, 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
