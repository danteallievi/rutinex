import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateTenantDto } from './dto/create-tenant.dto';
import { Tenant } from './entities/tenant.entity';
import { isReservedSlug } from './slug';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepository: Repository<Tenant>,
  ) {}

  async create(dto: CreateTenantDto): Promise<Tenant> {
    if (isReservedSlug(dto.slug)) {
      throw new ConflictException({
        code: 'SLUG_RESERVED',
        message: `Slug "${dto.slug}" is reserved and cannot be used.`,
      });
    }

    const existing = await this.tenantsRepository.findOne({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException({
        code: 'SLUG_TAKEN',
        message: `Slug "${dto.slug}" is already taken.`,
      });
    }

    const tenant = this.tenantsRepository.create({
      slug: dto.slug,
      name: dto.name,
      branding: dto.branding ?? {},
    });
    return this.tenantsRepository.save(tenant);
  }

  async findBySlug(slug: string): Promise<Tenant> {
    const tenant = await this.tenantsRepository.findOne({ where: { slug } });
    // No diferenciamos entre "no existe" e "is_active=false" para no
    // filtrar existencia de tenants (ver docs/03-multi-tenancy.md, casos borde).
    if (!tenant || !tenant.isActive) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: `Tenant with slug "${slug}" not found.`,
      });
    }
    return tenant;
  }
}
