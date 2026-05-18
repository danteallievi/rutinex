import type { Exercise, ExerciseMediaType } from '../entities/exercise.entity';

export interface ExerciseResponse {
  id: string;
  title: string;
  description: string;
  mediaUrl: string | null;
  mediaType: ExerciseMediaType;
  muscleGroups: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toExerciseResponse(exercise: Exercise): ExerciseResponse {
  return {
    id: exercise.id,
    title: exercise.title,
    description: exercise.description,
    mediaUrl: exercise.mediaUrl,
    mediaType: exercise.mediaType,
    muscleGroups: exercise.muscleGroups,
    createdBy: exercise.createdBy,
    createdAt: exercise.createdAt.toISOString(),
    updatedAt: exercise.updatedAt.toISOString(),
  };
}

export interface PaginatedExercisesResponse {
  data: ExerciseResponse[];
  page: number;
  pageSize: number;
  total: number;
}
