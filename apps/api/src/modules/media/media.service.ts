import { randomUUID } from 'node:crypto';

import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { ExercisesService } from '../exercises/exercises.service';
import type { ConfirmMediaDto } from './dto/confirm-media.dto';
import type { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import type {
  ConfirmMediaResponse,
  UploadUrlResponse,
} from './dto/media.response';
import { kindToExerciseMediaType, MEDIA_POLICY } from './media-types';
import { R2_CLIENT, R2_CONFIG, type R2Config } from './r2.config';

/**
 * Storage de media en Cloudflare R2 (Step 15, ADR-023).
 *
 * Flujo cliente:
 *  1. `POST /media/upload-url` con `{ kind, contentType, sizeBytes }` →
 *     devuelve `uploadUrl` (presigned PUT), `key` y `publicUrl`.
 *  2. Cliente hace `PUT <uploadUrl>` con el binario + `Content-Type` exacto.
 *  3. `POST /media/confirm` con `{ key, exerciseId }` → el service verifica
 *     que el objeto existe en R2, su size real y content-type coinciden con
 *     la política, y persiste `mediaUrl=publicUrl + mediaType=kind` en el
 *     exercise. Si la validación falla, borra el objeto y tira 400.
 *
 * El size declarado en el upload-url es fail-fast (sirve para rechazar
 * presign ante archivos obviamente grandes). El control real está en confirm,
 * porque el presigned PUT no firma `Content-Length` y un cliente podría
 * subir hasta saturar el bucket. R2 sí acepta, pero el confirm rechaza y
 * borra.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @Inject(R2_CLIENT) private readonly s3: S3Client | null,
    @Inject(R2_CONFIG) private readonly config: R2Config | null,
    private readonly exercisesService: ExercisesService,
  ) {}

  async createUploadUrl(
    tenantId: string,
    dto: CreateUploadUrlDto,
  ): Promise<UploadUrlResponse> {
    const { s3, config } = this.requireConfigured();
    const policy = MEDIA_POLICY[dto.kind];

    if (!policy.mimeTypes.includes(dto.contentType)) {
      throw new BadRequestException({
        code: 'MEDIA_CONTENT_TYPE_NOT_ALLOWED',
        message: `contentType "${dto.contentType}" no está permitido para kind=${dto.kind}.`,
      });
    }
    if (dto.sizeBytes > policy.maxBytes) {
      throw new BadRequestException({
        code: 'MEDIA_SIZE_EXCEEDED',
        message: `sizeBytes ${dto.sizeBytes} supera el límite de ${policy.maxBytes} para kind=${dto.kind}.`,
      });
    }

    const extension = policy.extensionByMime[dto.contentType];
    if (!extension) {
      throw new BadRequestException({
        code: 'MEDIA_CONTENT_TYPE_NOT_ALLOWED',
        message: `contentType "${dto.contentType}" no tiene extensión mapeada.`,
      });
    }

    const key = `tenants/${tenantId}/exercises/${randomUUID()}.${extension}`;
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: dto.contentType,
    });
    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: config.presignTtlSeconds,
    });

    return {
      uploadUrl,
      key,
      publicUrl: `${config.publicUrl}/${key}`,
      contentType: dto.contentType,
      expiresAt: new Date(
        Date.now() + config.presignTtlSeconds * 1000,
      ).toISOString(),
    };
  }

  async confirm(
    tenantId: string,
    dto: ConfirmMediaDto,
  ): Promise<ConfirmMediaResponse> {
    const { s3, config } = this.requireConfigured();
    const expectedPrefix = `tenants/${tenantId}/`;
    if (!dto.key.startsWith(expectedPrefix)) {
      throw new BadRequestException({
        code: 'MEDIA_KEY_NOT_OWNED',
        message: 'La key no pertenece a este tenant.',
      });
    }

    const head = await this.headOrFail(s3, config.bucket, dto.key);
    const contentType = head.ContentType;
    const size = head.ContentLength;
    const kind = inferKindFromContentType(contentType);

    if (!kind) {
      await this.safeDelete(s3, config.bucket, dto.key);
      throw new BadRequestException({
        code: 'MEDIA_CONTENT_TYPE_NOT_ALLOWED',
        message: `contentType "${contentType ?? 'unknown'}" no está permitido.`,
      });
    }

    const policy = MEDIA_POLICY[kind];
    if (size === undefined || size > policy.maxBytes) {
      await this.safeDelete(s3, config.bucket, dto.key);
      throw new BadRequestException({
        code: 'MEDIA_SIZE_EXCEEDED',
        message: `El archivo subido (${size ?? 'desconocido'} bytes) supera el límite de ${policy.maxBytes} para kind=${kind}.`,
      });
    }

    const mediaType = kindToExerciseMediaType(kind);
    const mediaUrl = `${config.publicUrl}/${dto.key}`;

    try {
      const exercise = await this.exercisesService.update(
        tenantId,
        dto.exerciseId,
        { mediaType, mediaUrl },
      );
      return { exercise };
    } catch (err) {
      // El exercise no existe (cross-tenant también devuelve 404, ADR-022) o
      // cualquier otro fallo persistiendo: borramos el blob para no dejar
      // huérfanos del path "happy". Si el blob no se puede borrar lo logueamos
      // pero no enmascaramos el error original.
      await this.safeDelete(s3, config.bucket, dto.key);
      throw err;
    }
  }

  private async headOrFail(
    s3: S3Client,
    bucket: string,
    key: string,
  ): Promise<{ ContentType?: string; ContentLength?: number }> {
    try {
      const result = await s3.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      return {
        ContentType: result.ContentType,
        ContentLength: result.ContentLength,
      };
    } catch (err) {
      const status =
        err instanceof Error && 'name' in err && err.name === 'NotFound'
          ? 404
          : (err as { $metadata?: { httpStatusCode?: number } }).$metadata
              ?.httpStatusCode;
      if (status === 404) {
        throw new BadRequestException({
          code: 'MEDIA_OBJECT_NOT_FOUND',
          message:
            'El objeto referenciado por la key no existe en el bucket. ¿Falta el PUT?',
        });
      }
      throw err;
    }
  }

  private async safeDelete(
    s3: S3Client,
    bucket: string,
    key: string,
  ): Promise<void> {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (err) {
      this.logger.warn(
        `No pude borrar el objeto huérfano ${key}: ${(err as Error).message}`,
      );
    }
  }

  private requireConfigured(): { s3: S3Client; config: R2Config } {
    if (!this.s3 || !this.config) {
      throw new ServiceUnavailableException({
        code: 'MEDIA_NOT_CONFIGURED',
        message:
          'Storage de media no está configurado en este entorno (faltan vars R2_*).',
      });
    }
    return { s3: this.s3, config: this.config };
  }
}

function inferKindFromContentType(
  contentType: string | undefined,
): 'video' | 'gif' | 'image' | null {
  if (!contentType) return null;
  for (const kind of ['video', 'gif', 'image'] as const) {
    if (MEDIA_POLICY[kind].mimeTypes.includes(contentType)) return kind;
  }
  return null;
}
