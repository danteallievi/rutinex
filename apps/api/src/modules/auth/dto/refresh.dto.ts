import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body de `POST /auth/refresh` y `POST /auth/logout`.
 *
 * `refreshToken` es opcional: si llega vía cookie httpOnly (`rutinex_refresh`,
 * ver ADR-017), el controller lo extrae de ahí. Si no llega por ninguna vía,
 * el service tira 401 genérico.
 */
export class RefreshDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(512)
  refreshToken?: string;
}
