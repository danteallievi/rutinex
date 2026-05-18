import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Exercise } from '../../exercises/entities/exercise.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Routine } from './routine.entity';

@Entity({ name: 'routine_items' })
@Index('ix_routine_items_tenant_id', ['tenantId'])
@Index('ix_routine_items_routine_id', ['routineId'])
@Index('ix_routine_items_exercise_id', ['exerciseId'])
@Index('uq_routine_items_routine_position', ['routineId', 'position'], {
  unique: true,
})
export class RoutineItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'tenant_id',
    foreignKeyConstraintName: 'fk_routine_items_tenant',
  })
  tenant?: Tenant;

  @Column({ name: 'routine_id', type: 'uuid' })
  routineId!: string;

  @ManyToOne(() => Routine, (routine) => routine.items, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'routine_id',
    foreignKeyConstraintName: 'fk_routine_items_routine',
  })
  routine?: Routine;

  @Column({ name: 'exercise_id', type: 'uuid' })
  exerciseId!: string;

  @ManyToOne(() => Exercise, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'exercise_id',
    foreignKeyConstraintName: 'fk_routine_items_exercise',
  })
  exercise?: Exercise;

  @Column({ type: 'int' })
  position!: number;

  @Column({ name: 'prescribed_sets', type: 'int' })
  prescribedSets!: number;

  @Column({ name: 'prescribed_reps', type: 'varchar', length: 50 })
  prescribedReps!: string;

  @Column({
    name: 'prescribed_weight',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  prescribedWeight!: string | null;

  @Column({ name: 'rest_seconds', type: 'int', nullable: true })
  restSeconds!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
