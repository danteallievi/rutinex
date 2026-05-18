import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { RoutineItemInputDto } from './routine-item-input.dto';

/**
 * Body de `PATCH /routines/:id`. Todos los campos opcionales.
 *
 * Si `items` viene, **reemplaza** el array completo (delete-then-insert
 * dentro de una transacción). Si no viene, los items existentes quedan
 * intactos. No se permite `items: []` (rutina vacía rompe el dominio).
 *
 * `description` acepta `null` explícito (limpiar) vs `undefined` (no tocar),
 * mismo patrón que `UpdateExerciseDto.mediaUrl`.
 */
export class UpdateRoutineDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RoutineItemInputDto)
  items?: RoutineItemInputDto[];
}
