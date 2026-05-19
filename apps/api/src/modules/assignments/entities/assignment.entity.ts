import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Routine } from '../../routines/entities/routine.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'assignments' })
@Index('ix_assignments_tenant_id', ['tenantId'])
@Index('ix_assignments_routine_id', ['routineId'])
@Index('ix_assignments_student_id', ['studentId'])
@Index('ix_assignments_assigned_by', ['assignedBy'])
export class Assignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'tenant_id',
    foreignKeyConstraintName: 'fk_assignments_tenant',
  })
  tenant?: Tenant;

  @Column({ name: 'routine_id', type: 'uuid' })
  routineId!: string;

  @ManyToOne(() => Routine, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'routine_id',
    foreignKeyConstraintName: 'fk_assignments_routine',
  })
  routine?: Routine;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'student_id',
    foreignKeyConstraintName: 'fk_assignments_student',
  })
  student?: User;

  @Column({ name: 'assigned_by', type: 'uuid' })
  assignedBy!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'assigned_by',
    foreignKeyConstraintName: 'fk_assignments_assigned_by',
  })
  assigner?: User;

  @Column({ name: 'starts_on', type: 'date' })
  startsOn!: string;

  @Column({ name: 'ends_on', type: 'date', nullable: true })
  endsOn!: string | null;

  @Column({ name: 'weekday_mask', type: 'int' })
  weekdayMask!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
