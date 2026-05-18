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
 * Body de `POST /routines`. Atómico: la rutina y todos sus items se persisten
 * en una sola transacción. Items requerido (≥1) — una rutina sin ejercicios
 * no tiene sentido de dominio.
 */
export class CreateRoutineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RoutineItemInputDto)
  items!: RoutineItemInputDto[];
}
