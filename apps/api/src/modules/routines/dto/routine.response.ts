import {
  toExerciseResponse,
  type ExerciseResponse,
} from '../../exercises/dto/exercise.response';
import type { Exercise } from '../../exercises/entities/exercise.entity';
import type { RoutineItem } from '../entities/routine-item.entity';
import type { Routine } from '../entities/routine.entity';

export interface RoutineItemResponse {
  id: string;
  exerciseId: string;
  position: number;
  prescribedSets: number;
  prescribedReps: string;
  prescribedWeight: string | null;
  restSeconds: number | null;
  notes: string | null;
  exercise: ExerciseResponse;
}

export interface RoutineResponse {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: RoutineItemResponse[];
}

export interface RoutineListItemResponse {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  itemsCount: number;
}

export interface PaginatedRoutinesResponse {
  data: RoutineListItemResponse[];
  page: number;
  pageSize: number;
  total: number;
}

export function toRoutineItemResponse(
  item: RoutineItem,
  exercise: Exercise,
): RoutineItemResponse {
  return {
    id: item.id,
    exerciseId: item.exerciseId,
    position: item.position,
    prescribedSets: item.prescribedSets,
    prescribedReps: item.prescribedReps,
    prescribedWeight: item.prescribedWeight,
    restSeconds: item.restSeconds,
    notes: item.notes,
    exercise: toExerciseResponse(exercise),
  };
}

export function toRoutineResponse(
  routine: Routine,
  items: RoutineItem[],
  exercisesById: Map<string, Exercise>,
): RoutineResponse {
  const orderedItems = [...items].sort((a, b) => a.position - b.position);
  return {
    id: routine.id,
    name: routine.name,
    description: routine.description,
    createdBy: routine.createdBy,
    createdAt: routine.createdAt.toISOString(),
    updatedAt: routine.updatedAt.toISOString(),
    items: orderedItems.map((item) => {
      const exercise = exercisesById.get(item.exerciseId);
      if (!exercise) {
        throw new Error(
          `Exercise "${item.exerciseId}" missing while building routine response`,
        );
      }
      return toRoutineItemResponse(item, exercise);
    }),
  };
}

export function toRoutineListItemResponse(
  routine: Routine,
  itemsCount: number,
): RoutineListItemResponse {
  return {
    id: routine.id,
    name: routine.name,
    description: routine.description,
    createdBy: routine.createdBy,
    createdAt: routine.createdAt.toISOString(),
    updatedAt: routine.updatedAt.toISOString(),
    itemsCount,
  };
}
