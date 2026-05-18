import type { ExerciseResponse } from '../../exercises/dto/exercise.response';

export interface UploadUrlResponse {
  /** URL presignada para PUT directo del binario al bucket de R2. */
  uploadUrl: string;
  /** Key del objeto dentro del bucket. El cliente la usa luego en `POST /media/confirm`. */
  key: string;
  /** URL pública resultante (la misma que va a quedar en `exercises.media_url` post-confirm). */
  publicUrl: string;
  /** ISO timestamp de cuándo expira el `uploadUrl`. */
  expiresAt: string;
  /** Mime type esperado: el cliente DEBE usar este `Content-Type` en el PUT, sino la firma falla. */
  contentType: string;
}

export interface ConfirmMediaResponse {
  exercise: ExerciseResponse;
}
