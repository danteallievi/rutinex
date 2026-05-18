import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export type TenantActiveFilter = 'true' | 'false' | 'all';

/**
 * Query de `GET /superadmin/tenants`. Paginación offset alineada con la
 * convención de `GET /users` (Step 12, ADR-020) y `docs/05-api-conventions.md`.
 *
 * Filtro `active`: `'true'` (sólo activos), `'false'` (sólo pausados),
 * `'all'` (default — incluye ambos).
 */
export class ListSuperadminTenantsQueryDto {
  @IsOptional()
  @IsIn(['true', 'false', 'all'])
  active?: TenantActiveFilter = 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
