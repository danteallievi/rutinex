import type { RoutineResponse } from '../../routines/dto/routine.response';

/**
 * Snapshot inmutable de la rutina al momento de arrancar la sesión.
 *
 * Shape congelado igual que `RoutineResponse` (Step 16): incluye `items` con
 * `position`, `prescribedX` y el `exercise` resuelto inline (id/título/media).
 * Si la rutina o sus exercises cambian después, la sesión sigue viendo el
 * estado original (ADR-026 §3).
 *
 * Es un *type alias* de `RoutineResponse` por simetría con `GET /routines/:id`
 * — si `RoutineResponse` cambia, el shape del snapshot lo refleja
 * automáticamente para sesiones nuevas. Filas viejas en DB conservan el
 * shape con el que fueron escritas (jsonb tolera campos extra/faltantes en
 * lectura — el frontend tiene que tolerar el shape histórico). Si en el
 * futuro `RoutineResponse` crece de forma incompatible, se versiona el
 * snapshot acá.
 */
export type SessionRoutineSnapshot = RoutineResponse;
