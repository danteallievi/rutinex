import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/**
 * Query de `GET /sessions`. Cursor-based (ADR-026 §8): para listas que crecen
 * con el uso real (un alumno hace decenas de sesiones por mes).
 *
 * - `studentId?`: filtro opcional. Si actor=STUDENT, debe matchear `actor.userId`
 *   (sino 403). Si actor=TRAINER, debe ser un STUDENT propio. OWNER libre.
 * - `from?`/`to?`: filtra por `started_at` (timestamptz) en formato ISO date
 *   (`YYYY-MM-DD`). `from` es inclusivo desde `T00:00:00Z`; `to` es exclusivo
 *   hasta el día siguiente — el service convierte el rango.
 * - `limit?`: default 20, max 100.
 * - `cursor?`: opaco. El cliente lo devuelve sin modificar para la próxima
 *   página.
 */
export class ListSessionsQueryDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  cursor?: string;
}
