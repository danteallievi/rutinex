import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Assignment } from '../../assignments/entities/assignment.entity';
import { Routine } from '../../routines/entities/routine.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import type { SessionRoutineSnapshot } from '../dto/session-snapshot';

@Entity({ name: 'sessions' })
@Index('ix_sessions_tenant_id', ['tenantId'])
@Index('ix_sessions_assignment_id', ['assignmentId'])
@Index('ix_sessions_routine_id', ['routineId'])
@Index('ix_sessions_student_id', ['studentId'])
// Partial unique: 1 sesión abierta por assignment (ADR-026 §4). Declarado en
// la entity para que el detector de drift de TypeORM no marque cambios contra
// la migración.
@Index('uq_sessions_assignment_open', ['assignmentId'], {
  unique: true,
  where: '"completed_at" IS NULL',
})
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'tenant_id',
    foreignKeyConstraintName: 'fk_sessions_tenant',
  })
  tenant?: Tenant;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId!: string;

  @ManyToOne(() => Assignment, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'assignment_id',
    foreignKeyConstraintName: 'fk_sessions_assignment',
  })
  assignment?: Assignment;

  @Column({ name: 'routine_id', type: 'uuid' })
  routineId!: string;

  @ManyToOne(() => Routine, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'routine_id',
    foreignKeyConstraintName: 'fk_sessions_routine',
  })
  routine?: Routine;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'student_id',
    foreignKeyConstraintName: 'fk_sessions_student',
  })
  student?: User;

  @Column({ name: 'routine_snapshot', type: 'jsonb' })
  routineSnapshot!: SessionRoutineSnapshot;

  @CreateDateColumn({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}
