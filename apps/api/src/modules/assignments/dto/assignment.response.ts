import type { Assignment } from '../entities/assignment.entity';

export type AssignmentStatus = 'active' | 'expired' | 'future';

export interface AssignmentResponse {
  id: string;
  routineId: string;
  studentId: string;
  assignedBy: string;
  startsOn: string;
  endsOn: string | null;
  weekdayMask: number;
  status: AssignmentStatus;
  createdAt: string;
}

/**
 * Calcula el `status` derivado de `(startsOn, endsOn, today)`. Usa el día
 * calendario del servidor (sin timezone awareness): consistente con la
 * columna `date` de Postgres, que tampoco tiene timezone.
 */
export function computeAssignmentStatus(
  startsOn: string,
  endsOn: string | null,
  today: string,
): AssignmentStatus {
  if (startsOn > today) return 'future';
  if (endsOn !== null && endsOn < today) return 'expired';
  return 'active';
}

export function todayDateString(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${String(year)}-${month}-${day}`;
}

export function toAssignmentResponse(
  assignment: Assignment,
  today: string = todayDateString(),
): AssignmentResponse {
  return {
    id: assignment.id,
    routineId: assignment.routineId,
    studentId: assignment.studentId,
    assignedBy: assignment.assignedBy,
    startsOn: assignment.startsOn,
    endsOn: assignment.endsOn,
    weekdayMask: assignment.weekdayMask,
    status: computeAssignmentStatus(
      assignment.startsOn,
      assignment.endsOn,
      today,
    ),
    createdAt: assignment.createdAt.toISOString(),
  };
}
