import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Tenant } from '../../tenants/entities/tenant.entity';

export type UserRole = 'OWNER' | 'TRAINER' | 'STUDENT';

export const USER_ROLES: readonly UserRole[] = ['OWNER', 'TRAINER', 'STUDENT'];

@Entity({ name: 'users' })
@Index('uq_users_tenant_email', ['tenantId', 'email'], { unique: true })
@Index('uq_users_tenant_dni', ['tenantId', 'dni'], { unique: true })
@Index('users_email_global_unique', ['email'], {
  unique: true,
  where: '"tenant_id" IS NULL',
})
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ix_users_tenant_id')
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'tenant_id',
    foreignKeyConstraintName: 'fk_users_tenant',
  })
  tenant?: Tenant | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  passwordHash!: string | null;

  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  mustChangePassword!: boolean;

  @Column({ name: 'is_superadmin', type: 'boolean', default: false })
  isSuperadmin!: boolean;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  dni!: string | null;

  @Column({
    type: 'enum',
    enum: USER_ROLES,
    enumName: 'user_role',
    nullable: true,
  })
  role!: UserRole | null;

  @Column({ name: 'trainer_id', type: 'uuid', nullable: true })
  trainerId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'trainer_id',
    foreignKeyConstraintName: 'fk_users_trainer',
  })
  trainer?: User | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
