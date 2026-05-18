import { Type } from 'class-transformer';
import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { BrandingDto } from '../../tenants/dto/branding.dto';
import {
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  SLUG_REGEX,
} from '../../tenants/slug';

/**
 * Datos del OWNER inicial que se crea junto al tenant. La password NO viaja
 * en el body — la genera el server (`PasswordService.generate()`) y la
 * devuelve en plano una sola vez en la response.
 */
export class CreateSuperadminTenantOwnerDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;
}

/**
 * Body de `POST /superadmin/tenants`. Crea tenant + OWNER inicial en una
 * sola transacción (ver `SuperadminTenantsService.create`).
 *
 * Reglas de slug compartidas con `docs/03-multi-tenancy.md`: regex
 * DNS-safe + longitud 3-63 + lista de reservados (validada en el service
 * con 409 `SLUG_RESERVED`).
 */
export class CreateSuperadminTenantDto {
  @IsString()
  @MinLength(SLUG_MIN_LENGTH)
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_REGEX, {
    message:
      'slug must be lowercase alphanumeric with optional single hyphens between groups (e.g. "olimpo", "fit-club")',
  })
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandingDto)
  branding?: BrandingDto;

  @IsObject({ message: 'owner is required and must be an object' })
  @ValidateNested()
  @Type(() => CreateSuperadminTenantOwnerDto)
  owner!: CreateSuperadminTenantOwnerDto;
}
