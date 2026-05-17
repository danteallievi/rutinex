import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';

import { User, UserRole } from './entities/user.entity';
import { CreateUserInput, UsersService } from './users.service';

type MockRepo = {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
};

function makeMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    create: jest.fn((input: Partial<User>) => input as User),
    save: jest.fn((input: User) => Promise.resolve(input)),
    update: jest.fn(),
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

  beforeEach(async () => {
    repo = makeMockRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
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
    it('actualiza is_active y propaga el cambio', async () => {
      repo.update.mockResolvedValueOnce({ affected: 1 });
      await service.setActive('user-id', false);
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'user-id' },
        { isActive: false },
      );
    });

    it('tira NotFoundException si no afecta filas', async () => {
      repo.update.mockResolvedValueOnce({ affected: 0 });
      await expect(service.setActive('missing', true)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setMustChangePassword', () => {
    it('actualiza el flag', async () => {
      repo.update.mockResolvedValueOnce({ affected: 1 });
      await service.setMustChangePassword('user-id', false);
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'user-id' },
        { mustChangePassword: false },
      );
    });

    it('tira NotFoundException si no afecta filas', async () => {
      repo.update.mockResolvedValueOnce({ affected: 0 });
      await expect(
        service.setMustChangePassword('missing', true),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
