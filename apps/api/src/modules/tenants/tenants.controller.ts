import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CreateTenantDto } from './dto/create-tenant.dto';
import { Tenant, TenantBranding } from './entities/tenant.entity';
import { TenantsService } from './tenants.service';

interface PublicTenantView {
  id: string;
  slug: string;
  name: string;
  branding: TenantBranding;
}

@Controller('tenants')
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
