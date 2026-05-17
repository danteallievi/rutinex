import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { Public } from '../auth/public.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { Tenant, TenantBranding } from './entities/tenant.entity';
import { TenantsService } from './tenants.service';

interface PublicTenantView {
  id: string;
  slug: string;
  name: string;
  branding: TenantBranding;
}

/**
 * Endpoints públicos del módulo Tenants.
 *
 * `POST /tenants` se mueve a `/superadmin/tenants` en Step 13. Hasta entonces
 * sigue público para que los tests E2E del Step 4 funcionen sin auth.
 * `GET /tenants/by-slug/:slug` queda público de forma permanente (lo consume
 * la página del tenant para resolver el branding antes del login).
 */
@Controller('tenants')
@Public()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  create(@Body() dto: CreateTenantDto): Promise<Tenant> {
    return this.tenantsService.create(dto);
  }

  @Get('by-slug/:slug')
  async findBySlug(@Param('slug') slug: string): Promise<PublicTenantView> {
    const tenant = await this.tenantsService.findBySlug(slug);
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      branding: tenant.branding,
    };
  }
}
