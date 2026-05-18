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
import { User } from '../../users/entities/user.entity';

export type ExerciseMediaType = 'video' | 'gif' | 'image' | 'none';

export const EXERCISE_MEDIA_TYPES: readonly ExerciseMediaType[] = [
  'video',
  'gif',
  'image',
  'none',
];

@Entity({ name: 'exercises' })
@Index('ix_exercises_tenant_id', ['tenantId'])
@Index('ix_exercises_muscle_groups', ['muscleGroups'])
export class Exercise {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'tenant_id',
    foreignKeyConstraintName: 'fk_exercises_tenant',
  })
  tenant?: Tenant;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({
    name: 'media_url',
    type: 'varchar',
    length: 1024,
    nullable: true,
  })
  mediaUrl!: string | null;

  @Column({
    name: 'media_type',
    type: 'enum',
    enum: EXERCISE_MEDIA_TYPES,
    enumName: 'exercise_media_type',
    default: 'none',
  })
  mediaType!: ExerciseMediaType;

  @Column({
    name: 'muscle_groups',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  muscleGroups!: string[];

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'created_by',
    foreignKeyConstraintName: 'fk_exercises_created_by',
  })
  creator?: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
