/* eslint-disable @typescript-eslint/unbound-method
   --
   Spec con mocks por property: ESLint flagueaba cada `expect(mock.method).toHaveBeenCalled...`
   como un riesgo de `this` perdido, pero los mocks son `jest.fn()` standalone — no
   tienen contexto que perder. */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { PasswordService } from '../auth/password.service';
import { RefreshTokenService } from '../auth/refresh-token.service';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { SuperadminTenantsService } from './superadmin-tenants.service';

type Repo = {
  findOne: jest.Mock;
  findAndCount: jest.Mock;
  find: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

function makeRepo(): Repo {
  return {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
}

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 't-1',
    slug: 'olimpo',
    name: 'Gimnasio Olimpo',
    branding: {},
    isActive: true,
    createdAt: new Date('2026-05-17T00:00:00Z'),
    updatedAt: new Date('2026-05-17T00:00:00Z'),
    ...overrides,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-1',
    tenantId: 't-1',
    email: 'owner@olimpo.test',
    passwordHash: 'hash',
    mustChangePassword: true,
    isSuperadmin: false,
    firstName: 'Olga',
    lastName: 'Owner',
    dni: null,
    role: 'OWNER',
    trainerId: null,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date('2026-05-17T00:00:00Z'),
    updatedAt: new Date('2026-05-17T00:00:00Z'),
    ...overrides,
  };
}

describe('SuperadminTenantsService', () => {
  let service: SuperadminTenantsService;
  let tenantRepo: Repo;
  let userRepo: Repo;
  let passwordService: jest.Mocked<PasswordService>;
  let refreshTokenService: jest.Mocked<RefreshTokenService>;

  const buildDataSource = (): DataSource => {
    const getRepository = jest.fn().mockImplementation((entity: unknown) => {
      if (entity === Tenant) return tenantRepo;
      if (entity === User) return userRepo;
      throw new Error('unknown entity');
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
    tenantRepo = makeRepo();
    userRepo = makeRepo();
    passwordService = {
      generate: jest.fn().mockReturnValue('generated-pass'),
      hash: jest.fn().mockResolvedValue('hashed-pass'),
      verify: jest.fn(),
    };
    refreshTokenService = {
      revokeAllForTenant: jest.fn().mockResolvedValue(0),
      revokeAllForUser: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<RefreshTokenService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuperadminTenantsService,
        { provide: DataSource, useValue: buildDataSource() },
        { provide: PasswordService, useValue: passwordService },
        { provide: RefreshTokenService, useValue: refreshTokenService },
      ],
    }).compile();

    service = module.get<SuperadminTenantsService>(SuperadminTenantsService);
  });

  // --------------------------------------------------------------------------
  // create
  // --------------------------------------------------------------------------
  describe('create', () => {
    const dto = {
      slug: 'olimpo',
      name: 'Gimnasio Olimpo',
      owner: {
        email: 'owner@olimpo.test',
        firstName: 'Olga',
        lastName: 'Owner',
      },
    };

    it('crea tenant + OWNER en transacción y devuelve la pass una vez', async () => {
      tenantRepo.findOne.mockResolvedValueOnce(null);
      const builtTenant = makeTenant();
      tenantRepo.create.mockReturnValueOnce(builtTenant);
      tenantRepo.save.mockResolvedValueOnce(builtTenant);

      const builtOwner = makeUser();
      userRepo.create.mockReturnValueOnce(builtOwner);
      userRepo.save.mockResolvedValueOnce(builtOwner);

      const result = await service.create(dto);

      expect(passwordService.generate).toHaveBeenCalledTimes(1);
      expect(passwordService.hash).toHaveBeenCalledWith('generated-pass');

      expect(tenantRepo.create).toHaveBeenCalledWith({
        slug: 'olimpo',
        name: 'Gimnasio Olimpo',
        branding: {},
        isActive: true,
      });
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't-1',
          role: 'OWNER',
          email: 'owner@olimpo.test',
          passwordHash: 'hashed-pass',
          mustChangePassword: true,
          isActive: true,
        }),
      );

      expect(result.tenant.slug).toBe('olimpo');
      expect(result.owner.email).toBe('owner@olimpo.test');
      expect(result.ownerPassword).toBe('generated-pass');
    });

    it('aplica branding cuando viene en el dto', async () => {
      tenantRepo.findOne.mockResolvedValueOnce(null);
      const builtTenant = makeTenant({
        branding: { primaryColor: '#FF0000' },
      });
      tenantRepo.create.mockReturnValueOnce(builtTenant);
      tenantRepo.save.mockResolvedValueOnce(builtTenant);
      userRepo.create.mockReturnValueOnce(makeUser());
      userRepo.save.mockResolvedValueOnce(makeUser());

      await service.create({ ...dto, branding: { primaryColor: '#FF0000' } });
      expect(tenantRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ branding: { primaryColor: '#FF0000' } }),
      );
    });

    it('rechaza con SLUG_RESERVED antes de tocar la DB', async () => {
      await expect(service.create({ ...dto, slug: 'admin' })).rejects.toThrow(
        ConflictException,
      );
      expect(tenantRepo.findOne).not.toHaveBeenCalled();
      expect(passwordService.hash).not.toHaveBeenCalled();
    });

    it('rechaza con SLUG_TAKEN dentro de la transacción si el slug ya existe', async () => {
      tenantRepo.findOne.mockResolvedValueOnce(makeTenant());
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(tenantRepo.save).not.toHaveBeenCalled();
      expect(userRepo.save).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // list
  // --------------------------------------------------------------------------
  describe('list', () => {
    it('default active=all: where vacío + paginación default', async () => {
      const rows = [makeTenant(), makeTenant({ id: 't-2', slug: 'spartan' })];
      tenantRepo.findAndCount.mockResolvedValueOnce([rows, 2]);

      const res = await service.list({});

      expect(tenantRepo.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(res.total).toBe(2);
      expect(res.data.length).toBe(2);
    });

    it('active=true → where.isActive=true', async () => {
      tenantRepo.findAndCount.mockResolvedValueOnce([[], 0]);
      await service.list({ active: 'true' });
      expect(tenantRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('active=false → where.isActive=false', async () => {
      tenantRepo.findAndCount.mockResolvedValueOnce([[], 0]);
      await service.list({ active: 'false' });
      expect(tenantRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: false } }),
      );
    });

    it('respeta page/pageSize', async () => {
      tenantRepo.findAndCount.mockResolvedValueOnce([[], 0]);
      await service.list({ page: 3, pageSize: 10 });
      expect(tenantRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  // --------------------------------------------------------------------------
  // update
  // --------------------------------------------------------------------------
  describe('update', () => {
    it('toggle a inactivo revoca refresh tokens del tenant', async () => {
      tenantRepo.findOne
        .mockResolvedValueOnce(makeTenant({ isActive: true }))
        .mockResolvedValueOnce(makeTenant({ isActive: false }));
      tenantRepo.update.mockResolvedValueOnce({ affected: 1 });

      const res = await service.update('t-1', { isActive: false });

      expect(tenantRepo.update).toHaveBeenCalledWith(
        { id: 't-1' },
        { isActive: false },
      );
      expect(refreshTokenService.revokeAllForTenant).toHaveBeenCalledWith(
        't-1',
      );
      expect(res.isActive).toBe(false);
    });

    it('toggle a activo NO revoca refresh tokens', async () => {
      tenantRepo.findOne
        .mockResolvedValueOnce(makeTenant({ isActive: false }))
        .mockResolvedValueOnce(makeTenant({ isActive: true }));
      tenantRepo.update.mockResolvedValueOnce({ affected: 1 });

      await service.update('t-1', { isActive: true });
      expect(refreshTokenService.revokeAllForTenant).not.toHaveBeenCalled();
    });

    it('edita branding sin tocar isActive', async () => {
      tenantRepo.findOne
        .mockResolvedValueOnce(makeTenant())
        .mockResolvedValueOnce(
          makeTenant({ branding: { primaryColor: '#0f0' } }),
        );
      tenantRepo.update.mockResolvedValueOnce({ affected: 1 });

      const res = await service.update('t-1', {
        branding: { primaryColor: '#0f0' },
      });
      expect(tenantRepo.update).toHaveBeenCalledWith(
        { id: 't-1' },
        { branding: { primaryColor: '#0f0' } },
      );
      expect(refreshTokenService.revokeAllForTenant).not.toHaveBeenCalled();
      expect(res.branding).toEqual({ primaryColor: '#0f0' });
    });

    it('404 TENANT_NOT_FOUND si el id no existe', async () => {
      tenantRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.update('t-x', { isActive: false })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // --------------------------------------------------------------------------
  // resetOwnerPassword
  // --------------------------------------------------------------------------
  describe('resetOwnerPassword', () => {
    it('sin ownerId: elige el primero por createdAt ASC y revoca refresh tokens', async () => {
      tenantRepo.findOne.mockResolvedValueOnce(makeTenant());
      const owner = makeUser();
      userRepo.findOne
        .mockResolvedValueOnce(owner)
        .mockResolvedValueOnce({ ...owner, mustChangePassword: true });
      userRepo.update.mockResolvedValueOnce({ affected: 1 });

      const res = await service.resetOwnerPassword('t-1');

      expect(userRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { tenantId: 't-1', role: 'OWNER' },
        order: { createdAt: 'ASC' },
      });
      expect(userRepo.update).toHaveBeenCalledWith(
        { id: 'u-1' },
        { passwordHash: 'hashed-pass', mustChangePassword: true },
      );
      expect(refreshTokenService.revokeAllForUser).toHaveBeenCalledWith('u-1');
      expect(res.ownerPassword).toBe('generated-pass');
      expect(res.owner.id).toBe('u-1');
    });

    it('con ownerId: filtra por (id, tenantId, role=OWNER)', async () => {
      tenantRepo.findOne.mockResolvedValueOnce(makeTenant());
      const owner = makeUser({ id: 'u-explicit' });
      userRepo.findOne
        .mockResolvedValueOnce(owner)
        .mockResolvedValueOnce(owner);
      userRepo.update.mockResolvedValueOnce({ affected: 1 });

      await service.resetOwnerPassword('t-1', 'u-explicit');
      expect(userRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { id: 'u-explicit', tenantId: 't-1', role: 'OWNER' },
      });
    });

    it('404 TENANT_NOT_FOUND si el tenant no existe', async () => {
      tenantRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.resetOwnerPassword('t-x')).rejects.toThrow(
        NotFoundException,
      );
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('404 OWNER_NOT_FOUND si el tenant no tiene OWNER', async () => {
      tenantRepo.findOne.mockResolvedValueOnce(makeTenant());
      userRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.resetOwnerPassword('t-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('404 OWNER_NOT_FOUND si el ownerId no es OWNER del tenant', async () => {
      tenantRepo.findOne.mockResolvedValueOnce(makeTenant());
      userRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.resetOwnerPassword('t-1', 'no-owner-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
