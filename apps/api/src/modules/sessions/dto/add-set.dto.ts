import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * Body de `POST /sessions/:id/sets`. Registra un set ejecutado dentro de la
 * sesión.
 *
 * - `routineItemId`: id del routine_item original al momento del snapshot.
 *   El service valida que el id exista en `session.routine_snapshot.items[]`
 *   (no en la tabla viva — la rutina pudo ser editada después y los ids
 *   actuales no necesariamente matchean los del snapshot, ver ADR-024 §3 +
 *   ADR-026 §6).
 * - `setNumber`: número del set para ese ejercicio. Pensado para que el
 *   cliente lo mande secuencial 1..N, pero el server sólo valida que sea
 *   `>= 1` y único por `(session_id, routine_item_id, set_number)` — no
 *   exige consecutividad.
 * - `reps`: enteros >= 0. Permite 0 para sets fallidos / lesión.
 * - `weightKg`: opcional, hasta 2 decimales, máximo 9999.99kg. `null` o
 *   ausente = bodyweight.
 */
export class AddSetDto {
  @IsUUID()
  routineItemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  setNumber!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  reps!: number;

  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999.99)
  weightKg?: number | null;
}
