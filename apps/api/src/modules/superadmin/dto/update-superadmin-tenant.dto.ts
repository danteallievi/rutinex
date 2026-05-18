import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';

import { BrandingDto } from '../../tenants/dto/branding.dto';

/**
 * Body de `PATCH /superadmin/tenants/:id`. Sólo se editan `is_active` y
 * `branding`. Slug y name son inmutables en MVP (slug por contrato de
 * subdominio; name si llegara a hacer falta, se agrega después).
 *
 * Si `isActive` pasa de `true` a `false`, el controller revoca todos los
 * refresh tokens del tenant para que ningún user del tenant pueda seguir
 * operando sin esperar 15min al vencimiento del access JWT.
 */
export class UpdateSuperadminTenantDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandingDto)
  branding?: BrandingDto;
}
