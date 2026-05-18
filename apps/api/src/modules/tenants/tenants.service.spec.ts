import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Tenant } from './entities/tenant.entity';
import { TenantsService } from './tenants.service';

type MockRepo = {
  findOne: jest.Mock;
};

function makeMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
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

  describe('findBySlugIncludingInactive', () => {
    it('devuelve el tenant incluso pausado', async () => {
      const tenant = makeTenant({ isActive: false });
      repo.findOne.mockResolvedValueOnce(tenant);
      await expect(service.findBySlugIncludingInactive('olimpo')).resolves.toBe(
        tenant,
      );
    });

    it('devuelve null cuando no existe (sin tirar)', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.findBySlugIncludingInactive('fantasma'),
      ).resolves.toBeNull();
    });
  });

  describe('findByIdIncludingInactive', () => {
    it('devuelve el tenant por id (incluso pausado)', async () => {
      const tenant = makeTenant({ isActive: false });
      repo.findOne.mockResolvedValueOnce(tenant);
      await expect(service.findByIdIncludingInactive(tenant.id)).resolves.toBe(
        tenant,
      );
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: tenant.id } });
    });
  });
});
