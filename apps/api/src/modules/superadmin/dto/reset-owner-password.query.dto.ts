import { IsOptional, IsUUID } from 'class-validator';

/**
 * Query opcional para `POST /superadmin/tenants/:id/reset-owner-password`.
 *
 * En MVP cada tenant tiene un único OWNER (creado por `POST /superadmin/tenants`),
 * así que el endpoint default-ea al "primero por createdAt". Si más adelante
 * un tenant termina con múltiples OWNERs (futuro: panel admin del tenant
 * permitiendo invitar otro OWNER), se puede apuntar al específico vía
 * `?ownerId=<uuid>`. Documentado en ADR-021.
 */
export class ResetOwnerPasswordQueryDto {
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
