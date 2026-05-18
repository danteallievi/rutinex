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
} from 'class-validator';

import {
  EXERCISE_MEDIA_TYPES,
  type ExerciseMediaType,
} from '../entities/exercise.entity';

/**
 * Body de `POST /exercises`.
 *
 * - `mediaType` es siempre requerido. Si es `none`, `mediaUrl` debe estar
 *   ausente; si es `video|gif|image`, `mediaUrl` es requerido (URL con
 *   protocolo http/https). La coherencia mediaType↔mediaUrl la valida el
 *   `ExercisesService` con 400 `EXERCISE_MEDIA_INCONSISTENT` (queda más
 *   legible que encadenar `@ValidateIf`s y deja un `code` parseable).
 * - `muscleGroups` opcional; default `[]`. Cada elemento es un slug textual
 *   (`chest`, `triceps`, etc.) — no validamos contra un enum cerrado en MVP
 *   para no bloquear casos legítimos (`forearms`, `calves-soleus`, etc.).
 */
export class CreateExerciseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsIn([...EXERCISE_MEDIA_TYPES])
  mediaType!: ExerciseMediaType;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(1024)
  mediaUrl?: string;

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
