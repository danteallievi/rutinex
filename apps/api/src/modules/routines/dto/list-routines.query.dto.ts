import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Query de `GET /routines`. Paginación offset + filtro opcional `q` (ILIKE
 * en `name`). Sin filtros por exerciseId/muscleGroups en MVP — si más
 * adelante el TRAINER necesita buscar "rutinas que usen press de banca",
 * se agrega un join + filtro.
 */
export class ListRoutinesQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  q?: string;

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
