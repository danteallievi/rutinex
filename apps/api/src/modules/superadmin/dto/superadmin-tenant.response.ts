import type {
  Tenant,
  TenantBranding,
} from '../../tenants/entities/tenant.entity';
import type { UserResponse } from '../../users/dto/user.response';

/**
 * Shape público de un tenant para la superficie SUPERADMIN. Incluye
 * `isActive` y timestamps (el `GET /tenants/by-slug/:slug` público los
 * oculta porque sólo el operador del producto los necesita).
 */
export interface SuperadminTenantResponse {
  id: string;
  slug: string;
  name: string;
  branding: TenantBranding;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toSuperadminTenantResponse(
  tenant: Tenant,
): SuperadminTenantResponse {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    branding: tenant.branding,
    isActive: tenant.isActive,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
  };
}

/**
 * Response de `POST /superadmin/tenants`. Devuelve la password del OWNER
 * en plano **una sola vez** — el SUPERADMIN la copia y la pasa por WhatsApp
 * (sales-led, F1 en `docs/02-dominio.md`). No se persiste en plano ni se
 * loggea.
 */
export interface CreateSuperadminTenantResponse {
  tenant: SuperadminTenantResponse;
  owner: UserResponse;
  ownerPassword: string;
}

/**
 * Response de `GET /superadmin/tenants` — paginación offset igual que
 * `GET /users` (Step 12).
 */
export interface PaginatedSuperadminTenantsResponse {
  data: SuperadminTenantResponse[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Response de `POST /superadmin/tenants/:id/reset-owner-password`. Misma
 * semántica que `POST /users/:id/reset-password` (Step 12): la password se
 * devuelve una sola vez y el target queda con `mustChangePassword=true`.
 * Incluye el owner para que el SUPERADMIN sepa cuál OWNER fue (relevante
 * cuando el endpoint resuelve el OWNER por default).
 */
export interface ResetOwnerPasswordResponse {
  owner: UserResponse;
  ownerPassword: string;
}
