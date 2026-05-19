import { IsUUID } from 'class-validator';

/**
 * Body de `POST /sessions`. La sesión arranca contra una asignación específica;
 * el snapshot de la rutina se congela server-side al momento del INSERT.
 *
 * Sin `routineId` en el body — la asignación ya lo determina (única fuente
 * de verdad). Sin `startedAt` — el server lo setea con `now()` para evitar
 * drift por reloj del cliente.
 */
export class CreateSessionDto {
  @IsUUID()
  assignmentId!: string;
}
