import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * Body de `POST /media/confirm`. El cliente pasa la `key` (devuelta por el
 * presign) y el `exerciseId` a asociar. El service verifica que la key sea de
 * este tenant, valida el objeto real con HEAD, y persiste el `mediaUrl` final
 * en `exercises.media_url`.
 */
export class ConfirmMediaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  key!: string;

  @IsUUID()
  exerciseId!: string;
}
