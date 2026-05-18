import { S3Client } from '@aws-sdk/client-s3';

/**
 * Cliente S3 configurado para Cloudflare R2 (ADR-004, ADR-023).
 *
 * Se inyecta por token para que los tests puedan sobreescribirlo con un mock
 * (ver `media.service.spec.ts` y `media.e2e-spec.ts`). En runtime, el factory
 * lee env (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`); si
 * falta alguna, el provider devuelve `null` y el `MediaService` responde
 * `503 MEDIA_NOT_CONFIGURED` a cualquier request.
 */
export const R2_CLIENT = Symbol('R2_CLIENT');

/** Token de DI para la config no-credencial (bucket, dominio público, TTL del presign). */
export const R2_CONFIG = Symbol('R2_CONFIG');

export interface R2Config {
  bucket: string;
  /** Base del dominio público del bucket. Sin barra final. Ver ADR-023. */
  publicUrl: string;
  /** TTL en segundos del presigned PUT. Default 300 (5min). */
  presignTtlSeconds: number;
}

export function buildR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    // R2 ignora el `forcePathStyle`; el SDK por default usa virtual-hosted
    // style que también funciona contra el endpoint de R2.
  });
}

export function buildR2Config(): R2Config | null {
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!bucket || !publicUrl) {
    return null;
  }
  const ttlRaw = process.env.R2_PRESIGN_TTL_SECONDS;
  const ttl = ttlRaw ? Number(ttlRaw) : 300;
  return {
    bucket,
    publicUrl: publicUrl.replace(/\/+$/, ''),
    presignTtlSeconds: Number.isFinite(ttl) && ttl > 0 ? ttl : 300,
  };
}
