import { IsNull, Repository } from 'typeorm';

import { TenantScopedRepository } from './tenant-scoped.repository';

/**
 * Tests del `TenantScopedRepository`. Mockeamos los métodos de `Repository`
 * vía spies sobre el prototype para no necesitar una DataSource real — sólo
 * nos interesa validar:
 *   - qué inputs hacen que el wrapper tire (sin llegar a super.*)
 *   - qué inputs delegan a super.* (cuando el filtro está)
 *   - que los escape hatches no tiren nunca
 */
describe('TenantScopedRepository', () => {
  // Instanciamos sin pasar por el constructor de Repository (que pide
  // entityManager/target). Sólo usamos los métodos del wrapper.
  const repo = Object.create(
    TenantScopedRepository.prototype,
  ) as TenantScopedRepository<{ tenantId?: string; email?: string }>;

  let findSpy: jest.SpyInstance;
  let findOneSpy: jest.SpyInstance;
  let findBySpy: jest.SpyInstance;
  let findOneBySpy: jest.SpyInstance;
  let countSpy: jest.SpyInstance;
  let countBySpy: jest.SpyInstance;
  let updateSpy: jest.SpyInstance;
  let deleteSpy: jest.SpyInstance;

  beforeEach(() => {
    findSpy = jest.spyOn(Repository.prototype, 'find').mockResolvedValue([]);
    findOneSpy = jest
      .spyOn(Repository.prototype, 'findOne')
      .mockResolvedValue(null);
    findBySpy = jest
      .spyOn(Repository.prototype, 'findBy')
      .mockResolvedValue([]);
    findOneBySpy = jest
      .spyOn(Repository.prototype, 'findOneBy')
      .mockResolvedValue(null);
    countSpy = jest.spyOn(Repository.prototype, 'count').mockResolvedValue(0);
    countBySpy = jest
      .spyOn(Repository.prototype, 'countBy')
      .mockResolvedValue(0);
    updateSpy = jest
      .spyOn(Repository.prototype, 'update')
      .mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });
    deleteSpy = jest
      .spyOn(Repository.prototype, 'delete')
      .mockResolvedValue({ affected: 0, raw: [] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('rechaza queries sin filtro de tenant', () => {
    it('find() sin opciones', async () => {
      await expect(repo.find()).rejects.toThrow(/tenant_id/);
      expect(findSpy).not.toHaveBeenCalled();
    });

    it('find() con where pero sin tenantId', async () => {
      await expect(repo.find({ where: { email: 'a@b.test' } })).rejects.toThrow(
        /tenant_id/,
      );
      expect(findSpy).not.toHaveBeenCalled();
    });

    it('findOne() con where sin tenantId', async () => {
      await expect(
        repo.findOne({ where: { email: 'a@b.test' } }),
      ).rejects.toThrow(/tenant_id/);
      expect(findOneSpy).not.toHaveBeenCalled();
    });

    it('findBy() sin tenantId', async () => {
      await expect(repo.findBy({ email: 'a@b.test' })).rejects.toThrow(
        /tenant_id/,
      );
      expect(findBySpy).not.toHaveBeenCalled();
    });

    it('findOneBy() sin tenantId', async () => {
      await expect(repo.findOneBy({ email: 'a@b.test' })).rejects.toThrow(
        /tenant_id/,
      );
      expect(findOneBySpy).not.toHaveBeenCalled();
    });

    it('count() sin opciones', async () => {
      await expect(repo.count()).rejects.toThrow(/tenant_id/);
      expect(countSpy).not.toHaveBeenCalled();
    });

    it('countBy() sin tenantId', async () => {
      await expect(repo.countBy({ email: 'a@b.test' })).rejects.toThrow(
        /tenant_id/,
      );
      expect(countBySpy).not.toHaveBeenCalled();
    });

    it('update() con criteria por id (sin tenantId)', async () => {
      await expect(
        repo.update({ tenantId: undefined }, {} as never),
      ).rejects.toThrow(/tenant_id/);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('delete() con criteria por id (sin tenantId)', async () => {
      await expect(repo.delete({ email: 'a@b.test' })).rejects.toThrow(
        /tenant_id/,
      );
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });

  describe('acepta queries con filtro de tenant', () => {
    it('find() con where.tenantId delega a super', async () => {
      const options = { where: { tenantId: 'tenant-a' } };
      await repo.find(options);
      expect(findSpy).toHaveBeenCalledWith(options);
    });

    it('find() con where.tenantId = IsNull() (SUPERADMIN) delega a super', async () => {
      const options = { where: { tenantId: IsNull() } };
      await repo.find(options);
      expect(findSpy).toHaveBeenCalledWith(options);
    });

    it('findOne() con where.tenantId delega a super', async () => {
      const options = { where: { tenantId: 'tenant-a', email: 'a@b.test' } };
      await repo.findOne(options);
      expect(findOneSpy).toHaveBeenCalledWith(options);
    });

    it('count() con where.tenantId delega a super', async () => {
      const options = { where: { tenantId: 'tenant-a' } };
      await repo.count(options);
      expect(countSpy).toHaveBeenCalledWith(options);
    });

    it('update() con criteria.tenantId delega a super', async () => {
      const criteria = { tenantId: 'tenant-a', id: 'user-x' } as never;
      const patch = { isActive: false } as never;
      await repo.update(criteria, patch);
      expect(updateSpy).toHaveBeenCalledWith(criteria, patch);
    });

    it('delete() con criteria.tenantId delega a super', async () => {
      const criteria = { tenantId: 'tenant-a', id: 'user-x' } as never;
      await repo.delete(criteria);
      expect(deleteSpy).toHaveBeenCalledWith(criteria);
    });
  });

  describe('OR (where array)', () => {
    it('rechaza si al menos un brazo no filtra por tenant', async () => {
      await expect(
        repo.find({
          where: [{ tenantId: 'A' }, { email: 'sin-tenant@x.test' }],
        }),
      ).rejects.toThrow(/tenant_id/);
      expect(findSpy).not.toHaveBeenCalled();
    });

    it('acepta si todos los brazos filtran por tenant', async () => {
      const options = {
        where: [
          { tenantId: 'A', email: 'a@x.test' },
          { tenantId: 'A', email: 'b@x.test' },
        ],
      };
      await repo.find(options);
      expect(findSpy).toHaveBeenCalledWith(options);
    });

    it('rechaza un OR vacío', async () => {
      await expect(repo.find({ where: [] })).rejects.toThrow(/tenant_id/);
      expect(findSpy).not.toHaveBeenCalled();
    });
  });

  describe('escape hatches (AcrossTenants)', () => {
    it('findAcrossTenants() llama a super.find sin chequeo', async () => {
      await repo.findAcrossTenants();
      expect(findSpy).toHaveBeenCalledWith(undefined);
    });

    it('findOneAcrossTenants() permite where sin tenantId', async () => {
      const options = { where: { email: 'a@b.test' } };
      await repo.findOneAcrossTenants(options);
      expect(findOneSpy).toHaveBeenCalledWith(options);
    });

    it('countAcrossTenants() sin where', async () => {
      await repo.countAcrossTenants();
      expect(countSpy).toHaveBeenCalledWith(undefined);
    });

    it('updateAcrossTenants() permite update por id sin tenantId', async () => {
      const criteria = { id: 'user-x' } as never;
      const patch = { isActive: false } as never;
      await repo.updateAcrossTenants(criteria, patch);
      expect(updateSpy).toHaveBeenCalledWith(criteria, patch);
    });

    it('deleteAcrossTenants() permite delete por id', async () => {
      const criteria = { id: 'user-x' } as never;
      await repo.deleteAcrossTenants(criteria);
      expect(deleteSpy).toHaveBeenCalledWith(criteria);
    });
  });
});
