import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import {
  EXERCISE_MEDIA_TYPES,
  type ExerciseMediaType,
} from '../entities/exercise.entity';

/**
 * Body de `PATCH /exercises/:id`. Todos los campos opcionales.
 *
 * `mediaUrl` puede llegar como string (URL) o como `null` explícito para
 * limpiar la media. El service valida la coherencia con `mediaType` (sea
 * el que ya tiene el exercise o el que viene en el body).
 */
export class UpdateExerciseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsIn([...EXERCISE_MEDIA_TYPES])
  mediaType?: ExerciseMediaType;

  // null explícito = "limpiar mediaUrl"; undefined = "no tocar".
  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(1024)
  mediaUrl?: string | null;

  @IsOptional()
  @Transform(({ value }): unknown => {
    if (Array.isArray(value)) {
      return (value as unknown[]).map((v) =>
        typeof v === 'string' ? v.trim() : v,
      );
    }
    return value as unknown;
  })
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(50, { each: true })
  muscleGroups?: string[];
}
