import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Tenant } from './entities/tenant.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepository: Repository<Tenant>,
  ) {}

  /**
   * Resuelve un tenant por slug para la página pública (`GET /tenants/by-slug/:slug`).
   * Si no existe o está pausado (`is_active=false`), tira 404 con
   * `code: TENANT_NOT_FOUND` — no se filtra existencia entre los dos casos
   * (ver `docs/03-multi-tenancy.md`, casos borde).
   */
  async findBySlug(slug: string): Promise<Tenant> {
    const tenant = await this.tenantsRepository.findOne({ where: { slug } });
    if (!tenant || !tenant.isActive) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: `Tenant with slug "${slug}" not found.`,
      });
    }
    return tenant;
  }

  /**
   * Devuelve el tenant aunque `is_active=false`. Pensado para el login:
   * el flujo necesita distinguir "slug inexistente" (401 genérico) de
   * "tenant pausado" (403 `TENANT_INACTIVE`), cosa que `findBySlug` no
   * permite porque devuelve 404 en ambos casos.
   */
  async findBySlugIncludingInactive(slug: string): Promise<Tenant | null> {
    return this.tenantsRepository.findOne({ where: { slug } });
  }

  /**
   * Devuelve el tenant por id (incluyendo `is_active=false`). Lo usa el flow
   * de refresh: el `user.tenantId` apunta directo al id del tenant y no hace
   * falta resolver por slug.
   */
  async findByIdIncludingInactive(id: string): Promise<Tenant | null> {
    return this.tenantsRepository.findOne({ where: { id } });
  }
}
