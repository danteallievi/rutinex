import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { USER_ROLES, type UserRole } from '../entities/user.entity';

/**
 * Query de `GET /users`. Paginación offset (default 20, max 100) y dos
 * filtros opcionales (`role`, `isActive`). El scope adicional por rol del
 * caller (TRAINER sólo ve sus students + a sí mismo) lo aplica el service.
 */
export class ListUsersQueryDto {
  @IsOptional()
  @IsIn([...USER_ROLES])
  role?: UserRole;

  @IsOptional()
  @Transform(({ value }): unknown => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value as unknown;
  })
  @IsBoolean()
  isActive?: boolean;

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
