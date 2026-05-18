import { IsIn, IsInt, IsString, MaxLength, Min } from 'class-validator';

import { MEDIA_KINDS, type MediaKind } from '../media-types';

/**
 * Body de `POST /media/upload-url`. El cliente declara qué va a subir; el
 * service valida que el `contentType` esté permitido para ese `kind` y que el
 * `sizeBytes` no supere el límite. El size declarado es fail-fast — en
 * `POST /media/confirm` se re-valida con HEAD contra el objeto real (ADR-023).
 */
export class CreateUploadUrlDto {
  @IsIn([...MEDIA_KINDS])
  kind!: MediaKind;

  @IsString()
  @MaxLength(100)
  contentType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
