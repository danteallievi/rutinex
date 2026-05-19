import { IsIn, IsOptional } from 'class-validator';

export const ASSIGNMENT_STATUSES = [
  'active',
  'expired',
  'future',
  'all',
] as const;
export type AssignmentStatusFilter = (typeof ASSIGNMENT_STATUSES)[number];

/**
 * Query de `GET /students/:id/assignments`. Sin paginación: el universo
 * realista por alumno es chico (decenas, no miles). Si más adelante un
 * alumno acumula años de asignaciones, sumamos paginación.
 *
 * `status`:
 * - `active`   → `starts_on <= today AND (ends_on IS NULL OR ends_on >= today)`
 * - `expired`  → `ends_on IS NOT NULL AND ends_on < today`
 * - `future`   → `starts_on > today`
 * - `all`      → sin filtro (default)
 */
export class ListAssignmentsQueryDto {
  @IsOptional()
  @IsIn(ASSIGNMENT_STATUSES)
  status?: AssignmentStatusFilter;
}
