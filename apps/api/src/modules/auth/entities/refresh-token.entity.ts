import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Refresh token persistido por hash (SHA-256 hex). El token plano vive sólo
 * en el cliente y en la response del endpoint que lo emite — nunca se loggea
 * ni se guarda en DB.
 *
 * Fuente de verdad del shape: `docs/04-auth.md` → "Refresh token".
 *
 * Invariantes:
 * - `tenant_id` NULL ⇔ el user es SUPERADMIN. Para users de tenant se persiste
 *   el tenant del user al momento de emitir el refresh.
 * - `revoked_at` NULL = activo. Una vez revocado nunca se desrevoca.
 * - `replaced_by` apunta al token nuevo cuando hubo rotación (Step 9).
 */
@Entity({ name: 'refresh_tokens' })
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('ix_refresh_tokens_tenant_id')
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'tenant_id',
    foreignKeyConstraintName: 'fk_refresh_tokens_tenant',
  })
  tenant?: Tenant | null;

  @Index('ix_refresh_tokens_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_refresh_tokens_user',
  })
  user?: User;

  @Index('uq_refresh_tokens_token_hash', { unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash!: string;

  @Index('ix_refresh_tokens_expires_at')
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'replaced_by', type: 'uuid', nullable: true })
  replacedBy!: string | null;

  @ManyToOne(() => RefreshToken, { onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'replaced_by',
    foreignKeyConstraintName: 'fk_refresh_tokens_replaced_by',
  })
  replacement?: RefreshToken | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
