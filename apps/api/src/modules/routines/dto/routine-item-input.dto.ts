import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

/**
 * Un item embebido en `POST /routines` o `PATCH /routines/:id` (cuando viene
 * el array `items`). La identidad (`id`) es derivada por la DB en cada
 * persistencia; al hacer PATCH reemplazamos todo el array, así que pasar `id`
 * desde el cliente no aporta — se ignora.
 *
 * `position` se acepta tal cual viene del cliente para preservar el orden
 * relativo; el service la normaliza a 1..N en una segunda pasada para que el
 * resultado en DB siempre sea consecutivo. El UNIQUE compuesto
 * `(routine_id, position)` cubre el caso de dos items con la misma posición
 * (devuelve 400 vía class-validator si están duplicados, ver
 * `CreateRoutineDto`).
 */
export class RoutineItemInputDto {
  @IsUUID()
  exerciseId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  position!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  prescribedSets!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  prescribedReps!: string;

  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  prescribedWeight?: string | null;

  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  restSeconds?: number | null;

  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
