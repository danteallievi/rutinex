import { Controller, Get, Param } from '@nestjs/common';

import { Public } from '../auth/public.decorator';
import { TenantBranding } from './entities/tenant.entity';
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
 * `GET /tenants/by-slug/:slug` lo consume la página del tenant en la web
 * para resolver branding antes de cualquier login. Devuelve sólo lo público:
 * sin `is_active`, sin timestamps. Si el tenant no existe o está pausado,
 * devuelve 404 `TENANT_NOT_FOUND` (no se filtra existencia).
 *
 * El alta de tenants vive en `POST /superadmin/tenants` desde el Step 13
 * (sales-led, ver ADR-012). Acá no hay endpoint de creación.
 */
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Public()
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
