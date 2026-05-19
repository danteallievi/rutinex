import type {
  PersonalRecord,
  PersonalRecordType,
} from '../entities/personal-record.entity';

export interface PersonalRecordResponse {
  id: string;
  studentId: string;
  exerciseId: string;
  recordType: PersonalRecordType;
  weightKg: number;
  reps: number;
  achievedAt: string;
  setId: string;
}

export function toPersonalRecordResponse(
  pr: PersonalRecord,
): PersonalRecordResponse {
  return {
    id: pr.id,
    studentId: pr.studentId,
    exerciseId: pr.exerciseId,
    recordType: pr.recordType,
    weightKg: Number(pr.weightKg),
    reps: pr.reps,
    achievedAt: pr.achievedAt.toISOString(),
    setId: pr.setId,
  };
}
