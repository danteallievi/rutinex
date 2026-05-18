import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Query de `GET /exercises`.
 *
 * - `q`: search por título (ILIKE, case-insensitive).
 * - `muscleGroups`: filtro por intersección de muscle groups. Acepta
 *   `?muscleGroups=chest,triceps` (CSV) o `?muscleGroups=chest&muscleGroups=triceps`
 *   (repetido). El filtro hace OR semántico: matchea cualquier exercise que
 *   tenga al menos uno de los grupos pedidos (operador `&&` de Postgres).
 * - Paginación offset (default 20, max 100) — consistente con `users`.
 */
export class ListExercisesQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  q?: string;

  @IsOptional()
  @Transform(({ value }): unknown => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    if (Array.isArray(value)) {
      return (value as unknown[])
        .map((v) => (typeof v === 'string' ? v.trim() : v))
        .filter((v): v is string => typeof v === 'string' && v.length > 0);
    }
    return value as unknown;
  })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(50, { each: true })
  muscleGroups?: string[];

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
