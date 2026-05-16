import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { CreateTenantDto } from './dto/create-tenant.dto';
import { Tenant } from './entities/tenant.entity';
import { TenantsService } from './tenants.service';

type MockRepo = {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

function makeMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
}

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    slug: 'olimpo',
    name: 'Gimnasio Olimpo',
    branding: {},
    isActive: true,
    createdAt: new Date('2026-05-16T00:00:00.000Z'),
    updatedAt: new Date('2026-05-16T00:00:00.000Z'),
    ...overrides,
  };
}

describe('TenantsService', () => {
  let service: TenantsService;
  let repo: MockRepo;

  beforeEach(async () => {
    repo = makeMockRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: getRepositoryToken(Tenant), useValue: repo },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  describe('create', () => {
    const dto: CreateTenantDto = {
      slug: 'olimpo',
      name: 'Gimnasio Olimpo',
    };

    it('crea un tenant cuando el slug está libre y no es reservado', async () => {
      const built = makeTenant({ slug: dto.slug, name: dto.name });
      repo.findOne.mockResolvedValueOnce(null);
      repo.create.mockReturnValueOnce(built);
      repo.save.mockResolvedValueOnce(built);

      const result = await service.create(dto);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { slug: 'olimpo' } });
      expect(repo.create).toHaveBeenCalledWith({
        slug: 'olimpo',
        name: 'Gimnasio Olimpo',
        branding: {},
      });
      expect(repo.save).toHaveBeenCalledWith(built);
      expect(result).toBe(built);
    });

    it('aplica el branding recibido al crear', async () => {
      const branding = { primaryColor: '#FF0000' };
      const built = makeTenant({ branding });
      repo.findOne.mockResolvedValueOnce(null);
      repo.create.mockReturnValueOnce(built);
      repo.save.mockResolvedValueOnce(built);

      await service.create({ ...dto, branding });

      expect(repo.create).toHaveBeenCalledWith({
        slug: 'olimpo',
        name: 'Gimnasio Olimpo',
        branding,
      });
    });

    it('rechaza con ConflictException si el slug está reservado', async () => {
      await expect(service.create({ ...dto, slug: 'admin' })).rejects.toThrow(
        ConflictException,
      );
      expect(repo.findOne).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rechaza con ConflictException si el slug ya existe', async () => {
      repo.findOne.mockResolvedValueOnce(makeTenant({ slug: 'olimpo' }));

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('findBySlug', () => {
    it('devuelve el tenant cuando existe y está activo', async () => {
      const tenant = makeTenant();
      repo.findOne.mockResolvedValueOnce(tenant);

      await expect(service.findBySlug('olimpo')).resolves.toBe(tenant);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { slug: 'olimpo' } });
    });

    it('tira NotFoundException cuando no existe', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(service.findBySlug('olimpo')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('tira NotFoundException cuando is_active=false (no filtra existencia)', async () => {
      repo.findOne.mockResolvedValueOnce(makeTenant({ isActive: false }));
      await expect(service.findBySlug('olimpo')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
