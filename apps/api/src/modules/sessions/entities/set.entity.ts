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
import { RoutineItem } from '../../routines/entities/routine-item.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { Session } from './session.entity';

@Entity({ name: 'sets' })
@Index('ix_sets_tenant_id', ['tenantId'])
@Index('ix_sets_session_id', ['sessionId'])
@Index('ix_sets_routine_item_id', ['routineItemId'])
@Index('ix_sets_exercise_id', ['exerciseId'])
@Index('ix_sets_student_id', ['studentId'])
export class WorkoutSet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'tenant_id',
    foreignKeyConstraintName: 'fk_sets_tenant',
  })
  tenant?: Tenant;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'session_id',
    foreignKeyConstraintName: 'fk_sets_session',
  })
  session?: Session;

  /**
   * Apunta al `routine_items.id` original al momento de la sesión. Nullable +
   * `ON DELETE SET NULL` para sobrevivir a un PATCH replace-all del routine
   * (ADR-024 §3) — el snapshot tiene los datos del item, esta columna queda
   * sólo como pista para queries de tracking de PR en el routine actual.
   */
  @Column({ name: 'routine_item_id', type: 'uuid', nullable: true })
  routineItemId!: string | null;

  @ManyToOne(() => RoutineItem, { onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'routine_item_id',
    foreignKeyConstraintName: 'fk_sets_routine_item',
  })
  routineItem?: RoutineItem;

  @Column({ name: 'exercise_id', type: 'uuid' })
  exerciseId!: string;

  @ManyToOne(() => Exercise, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'exercise_id',
    foreignKeyConstraintName: 'fk_sets_exercise',
  })
  exercise?: Exercise;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'student_id',
    foreignKeyConstraintName: 'fk_sets_student',
  })
  student?: User;

  @Column({ name: 'set_number', type: 'int' })
  setNumber!: number;

  @Column({ type: 'int' })
  reps!: number;

  /**
   * `numeric(6,2)` mapea a string en TypeORM (los `numeric` arbitrary-precision
   * pierden datos si los castea a `number`). Service decide la conversión cuando
   * arme la response.
   */
  @Column({
    name: 'weight_kg',
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  weightKg!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
