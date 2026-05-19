import type { Session } from '../entities/session.entity';
import type { WorkoutSet } from '../entities/set.entity';
import type { SessionRoutineSnapshot } from './session-snapshot';

export interface SetResponse {
  id: string;
  sessionId: string;
  routineItemId: string | null;
  exerciseId: string;
  studentId: string;
  setNumber: number;
  reps: number;
  weightKg: number | null;
  createdAt: string;
}

export interface SessionResponse {
  id: string;
  assignmentId: string;
  routineId: string;
  studentId: string;
  routineSnapshot: SessionRoutineSnapshot;
  startedAt: string;
  completedAt: string | null;
  sets: SetResponse[];
}

/**
 * Forma compacta para listas — el snapshot puede ser pesado, así que en
 * `GET /sessions` devolvemos sólo metadata + nombre del routine (que viene
 * del snapshot). Detalle se trae con `GET /sessions/:id` (no implementado en
 * Step 18, queda para próximo step si aparece la pantalla de revisión).
 */
export interface SessionListItemResponse {
  id: string;
  assignmentId: string;
  routineId: string;
  routineName: string;
  studentId: string;
  startedAt: string;
  completedAt: string | null;
}

export interface CursorPaginatedSessionsResponse {
  data: SessionListItemResponse[];
  nextCursor: string | null;
}

export interface TodaySessionResponse {
  assignmentId: string;
  routineId: string;
  routine: SessionRoutineSnapshot;
  openSessionId: string | null;
}

export function toSetResponse(set: WorkoutSet): SetResponse {
  return {
    id: set.id,
    sessionId: set.sessionId,
    routineItemId: set.routineItemId,
    exerciseId: set.exerciseId,
    studentId: set.studentId,
    setNumber: set.setNumber,
    reps: set.reps,
    weightKg: set.weightKg === null ? null : Number(set.weightKg),
    createdAt: set.createdAt.toISOString(),
  };
}

export function toSessionResponse(
  session: Session,
  sets: WorkoutSet[],
): SessionResponse {
  const orderedSets = [...sets].sort((a, b) => {
    if (a.createdAt.getTime() !== b.createdAt.getTime()) {
      return a.createdAt.getTime() - b.createdAt.getTime();
    }
    return a.setNumber - b.setNumber;
  });
  return {
    id: session.id,
    assignmentId: session.assignmentId,
    routineId: session.routineId,
    studentId: session.studentId,
    routineSnapshot: session.routineSnapshot,
    startedAt: session.startedAt.toISOString(),
    completedAt:
      session.completedAt === null ? null : session.completedAt.toISOString(),
    sets: orderedSets.map(toSetResponse),
  };
}

export function toSessionListItemResponse(
  session: Session,
): SessionListItemResponse {
  return {
    id: session.id,
    assignmentId: session.assignmentId,
    routineId: session.routineId,
    routineName: session.routineSnapshot.name,
    studentId: session.studentId,
    startedAt: session.startedAt.toISOString(),
    completedAt:
      session.completedAt === null ? null : session.completedAt.toISOString(),
  };
}
