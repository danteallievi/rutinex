import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Exercise } from '../../exercises/entities/exercise.entity';
import { WorkoutSet } from '../../sessions/entities/set.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';

export type PersonalRecordType =
  | 'max_weight'
  | 'max_reps_at_weight'
  | 'max_volume';

export const PERSONAL_RECORD_TYPES: readonly PersonalRecordType[] = [
  'max_weight',
  'max_reps_at_weight',
  'max_volume',
];

@Entity({ name: 'personal_records' })
@Index('ix_personal_records_tenant_id', ['tenantId'])
@Index('ix_personal_records_student_id', ['studentId'])
@Index('ix_personal_records_exercise_id', ['exerciseId'])
@Index('ix_personal_records_set_id', ['setId'])
// UNIQUE compuesto (tenant_id, student_id, exercise_id, record_type) — el
// pivote del UPSERT atómico que resuelve la concurrencia (ADR-027 §4).
@Index(
  'uq_personal_records_target',
  ['tenantId', 'studentId', 'exerciseId', 'recordType'],
  { unique: true },
)
export class PersonalRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'tenant_id',
    foreignKeyConstraintName: 'fk_personal_records_tenant',
  })
  tenant?: Tenant;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'student_id',
    foreignKeyConstraintName: 'fk_personal_records_student',
  })
  student?: User;

  @Column({ name: 'exercise_id', type: 'uuid' })
  exerciseId!: string;

  @ManyToOne(() => Exercise, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'exercise_id',
    foreignKeyConstraintName: 'fk_personal_records_exercise',
  })
  exercise?: Exercise;

  @Column({
    name: 'record_type',
    type: 'enum',
    enum: PERSONAL_RECORD_TYPES,
    enumName: 'personal_record_type',
  })
  recordType!: PersonalRecordType;

  /**
   * Peso de referencia del PR. NOT NULL: sets con `weight_kg=null`
   * (bodyweight) se skipean del cálculo en Step 19. `numeric(6,2)` mapea a
   * string en TypeORM (mismo patrón que `sets.weight_kg`).
   */
  @Column({ name: 'weight_kg', type: 'numeric', precision: 6, scale: 2 })
  weightKg!: string;

  @Column({ type: 'int' })
  reps!: number;

  /**
   * Cuándo se logró el PR. Se setea con `now()` en el UPSERT — coincide con el
   * momento del INSERT del set (la transacción es la misma). Mantiene el viejo
   * en empate (hard-PR, ADR-027 §3).
   */
  @CreateDateColumn({ name: 'achieved_at', type: 'timestamptz' })
  achievedAt!: Date;

  @Column({ name: 'set_id', type: 'uuid' })
  setId!: string;

  @ManyToOne(() => WorkoutSet, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'set_id',
    foreignKeyConstraintName: 'fk_personal_records_set',
  })
  set?: WorkoutSet;
}
