import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * Body de `POST /routines/:id/assignments`.
 *
 * `weekdayMask`: int bitmask 1..127. Bit 0 = Domingo, bit 1 = Lunes, …,
 * bit 6 = Sábado (alineado con `docs/02-dominio.md`). 0 no es válido (un
 * assignment sin días no se ejecuta nunca) — se rechaza en service con
 * 400 `ASSIGNMENT_WEEKDAY_MASK_EMPTY`. El máximo 127 = todos los días.
 *
 * `startsOn`/`endsOn`: date-only en formato ISO `YYYY-MM-DD`. La columna en DB
 * es `date` (sin time) — los tiempos del cliente se ignoran. `endsOn` opcional;
 * si está presente, debe ser `>= startsOn` (validado en service).
 */
export class CreateAssignmentDto {
  @IsUUID()
  studentId!: string;

  @IsISO8601({ strict: true })
  startsOn!: string;

  @IsOptional()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsISO8601({ strict: true })
  endsOn?: string | null;

  @IsInt()
  @Min(1)
  @Max(127)
  weekdayMask!: number;
}
