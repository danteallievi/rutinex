import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import {
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import type { ExerciseResponse } from '../exercises/dto/exercise.response';
import { ExercisesService } from '../exercises/exercises.service';
import { MediaService } from './media.service';
import type { R2Config } from './r2.config';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const getSignedUrlMock = getSignedUrl as jest.MockedFunction<
  typeof getSignedUrl
>;

interface FakeS3 {
  send: jest.Mock;
}

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const EXERCISE_ID = '22222222-2222-2222-2222-222222222222';

function buildExerciseResponse(
  overrides: Partial<ExerciseResponse> = {},
): ExerciseResponse {
  return {
    id: EXERCISE_ID,
    title: 'Press de banca',
    description: '',
    mediaUrl: null,
    mediaType: 'none',
    muscleGroups: [],
    createdBy: '33333333-3333-3333-3333-333333333333',
    createdAt: '2026-05-18T00:00:00.000Z',
    updatedAt: '2026-05-18T00:00:00.000Z',
    ...overrides,
  };
}

describe('MediaService', () => {
  let service: MediaService;
  let s3: FakeS3;
  let config: R2Config;
  let exercisesService: { update: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    s3 = { send: jest.fn() };
    config = {
      bucket: 'rutinex-media-test',
      publicUrl: 'https://media.example.com',
      presignTtlSeconds: 300,
    };
    exercisesService = { update: jest.fn() };
    service = new MediaService(
      s3 as unknown as ConstructorParameters<typeof MediaService>[0],
      config,
      exercisesService as unknown as ExercisesService,
    );
    // Silenciamos los `logger.warn` del safeDelete para que el test output sea limpio.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    getSignedUrlMock.mockResolvedValue('https://signed.example/upload?sig=abc');
  });

  describe('createUploadUrl', () => {
    it('firma una URL para video/mp4 con la key bajo tenants/<tenantId>/exercises', async () => {
      const result = await service.createUploadUrl(TENANT_ID, {
        kind: 'video',
        contentType: 'video/mp4',
        sizeBytes: 10 * 1024 * 1024,
      });

      expect(result.uploadUrl).toBe('https://signed.example/upload?sig=abc');
      expect(result.key).toMatch(
        new RegExp(`^tenants/${TENANT_ID}/exercises/[0-9a-f-]+\\.mp4$`),
      );
      expect(result.publicUrl).toBe(`${config.publicUrl}/${result.key}`);
      expect(result.contentType).toBe('video/mp4');
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());

      expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
      const [, command, opts] = getSignedUrlMock.mock.calls[0]!;
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect((command as PutObjectCommand).input.Bucket).toBe(config.bucket);
      expect((command as PutObjectCommand).input.Key).toBe(result.key);
      expect((command as PutObjectCommand).input.ContentType).toBe('video/mp4');
      expect(opts).toEqual({ expiresIn: 300 });
    });

    it.each([
      ['gif', 'image/gif', 'gif'],
      ['image', 'image/png', 'png'],
      ['image', 'image/jpeg', 'jpg'],
      ['image', 'image/webp', 'webp'],
      ['video', 'video/webm', 'webm'],
      ['video', 'video/quicktime', 'mov'],
    ] as const)(
      'firma una URL para kind=%s y contentType=%s con extensión .%s',
      async (kind, contentType, ext) => {
        const result = await service.createUploadUrl(TENANT_ID, {
          kind,
          contentType,
          sizeBytes: 1024,
        });
        expect(result.key.endsWith(`.${ext}`)).toBe(true);
      },
    );

    it('rechaza contentType no permitido para el kind (MEDIA_CONTENT_TYPE_NOT_ALLOWED)', async () => {
      await expect(
        service.createUploadUrl(TENANT_ID, {
          kind: 'image',
          contentType: 'image/heic',
          sizeBytes: 100,
        }),
      ).rejects.toMatchObject({
        response: {
          code: 'MEDIA_CONTENT_TYPE_NOT_ALLOWED',
        },
      });
      expect(getSignedUrlMock).not.toHaveBeenCalled();
    });

    it('rechaza sizeBytes que supera el límite del kind (MEDIA_SIZE_EXCEEDED)', async () => {
      await expect(
        service.createUploadUrl(TENANT_ID, {
          kind: 'gif',
          contentType: 'image/gif',
          sizeBytes: 11 * 1024 * 1024,
        }),
      ).rejects.toMatchObject({
        response: { code: 'MEDIA_SIZE_EXCEEDED' },
      });
      expect(getSignedUrlMock).not.toHaveBeenCalled();
    });

    it('falla con 503 MEDIA_NOT_CONFIGURED si falta el cliente S3', async () => {
      const notConfigured = new MediaService(
        null,
        config,
        exercisesService as unknown as ExercisesService,
      );
      const promise = notConfigured.createUploadUrl(TENANT_ID, {
        kind: 'image',
        contentType: 'image/png',
        sizeBytes: 1024,
      });
      await expect(promise).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(promise).rejects.toMatchObject({
        response: { code: 'MEDIA_NOT_CONFIGURED' },
      });
    });
  });

  describe('confirm', () => {
    const VALID_KEY = `tenants/${TENANT_ID}/exercises/abc.mp4`;

    it('asocia la media al exercise tras HEAD válido', async () => {
      s3.send.mockImplementation(
        (command: { constructor: { name: string } }) => {
          if (command instanceof HeadObjectCommand) {
            return Promise.resolve({
              ContentType: 'video/mp4',
              ContentLength: 5 * 1024 * 1024,
            });
          }
          return Promise.resolve({});
        },
      );
      const updated = buildExerciseResponse({
        mediaType: 'video',
        mediaUrl: `${config.publicUrl}/${VALID_KEY}`,
      });
      exercisesService.update.mockResolvedValue(updated);

      const result = await service.confirm(TENANT_ID, {
        key: VALID_KEY,
        exerciseId: EXERCISE_ID,
      });

      expect(result.exercise).toEqual(updated);
      expect(exercisesService.update).toHaveBeenCalledWith(
        TENANT_ID,
        EXERCISE_ID,
        {
          mediaType: 'video',
          mediaUrl: `${config.publicUrl}/${VALID_KEY}`,
        },
      );
    });

    it('rechaza key con prefix de otro tenant (MEDIA_KEY_NOT_OWNED)', async () => {
      await expect(
        service.confirm(TENANT_ID, {
          key: 'tenants/other-tenant/exercises/abc.mp4',
          exerciseId: EXERCISE_ID,
        }),
      ).rejects.toMatchObject({
        response: { code: 'MEDIA_KEY_NOT_OWNED' },
      });
      expect(s3.send).not.toHaveBeenCalled();
    });

    it('si el objeto no existe en R2 → 400 MEDIA_OBJECT_NOT_FOUND', async () => {
      const notFoundError = Object.assign(new Error('not found'), {
        name: 'NotFound',
        $metadata: { httpStatusCode: 404 },
      });
      s3.send.mockRejectedValueOnce(notFoundError);

      await expect(
        service.confirm(TENANT_ID, { key: VALID_KEY, exerciseId: EXERCISE_ID }),
      ).rejects.toMatchObject({
        response: { code: 'MEDIA_OBJECT_NOT_FOUND' },
      });
    });

    it('si el HEAD devuelve un contentType no permitido, borra y rechaza', async () => {
      s3.send.mockImplementation((command) => {
        if (command instanceof HeadObjectCommand) {
          return Promise.resolve({
            ContentType: 'application/octet-stream',
            ContentLength: 1024,
          });
        }
        if (command instanceof DeleteObjectCommand) {
          return Promise.resolve({});
        }
        return Promise.resolve({});
      });

      await expect(
        service.confirm(TENANT_ID, { key: VALID_KEY, exerciseId: EXERCISE_ID }),
      ).rejects.toMatchObject({
        response: { code: 'MEDIA_CONTENT_TYPE_NOT_ALLOWED' },
      });

      const deleteCalls = s3.send.mock.calls.filter(
        (call) => (call as unknown[])[0] instanceof DeleteObjectCommand,
      ) as [DeleteObjectCommand][];
      expect(deleteCalls).toHaveLength(1);
      expect(deleteCalls[0]![0].input.Key).toBe(VALID_KEY);
      expect(exercisesService.update).not.toHaveBeenCalled();
    });

    it('si el HEAD devuelve un size mayor al límite, borra y rechaza', async () => {
      s3.send.mockImplementation((command) => {
        if (command instanceof HeadObjectCommand) {
          return Promise.resolve({
            ContentType: 'video/mp4',
            ContentLength: 51 * 1024 * 1024,
          });
        }
        if (command instanceof DeleteObjectCommand) {
          return Promise.resolve({});
        }
        return Promise.resolve({});
      });

      await expect(
        service.confirm(TENANT_ID, { key: VALID_KEY, exerciseId: EXERCISE_ID }),
      ).rejects.toMatchObject({
        response: { code: 'MEDIA_SIZE_EXCEEDED' },
      });

      const deleteCalls = s3.send.mock.calls.filter(
        ([cmd]) => cmd instanceof DeleteObjectCommand,
      );
      expect(deleteCalls).toHaveLength(1);
      expect(exercisesService.update).not.toHaveBeenCalled();
    });

    it('si exercisesService.update tira (exercise inexistente), borra el blob y propaga el error', async () => {
      s3.send.mockImplementation((command) => {
        if (command instanceof HeadObjectCommand) {
          return Promise.resolve({
            ContentType: 'image/png',
            ContentLength: 1024,
          });
        }
        if (command instanceof DeleteObjectCommand) {
          return Promise.resolve({});
        }
        return Promise.resolve({});
      });
      const notFound = new BadRequestException({
        code: 'EXERCISE_NOT_FOUND',
        message: 'no existe',
      });
      exercisesService.update.mockRejectedValueOnce(notFound);

      await expect(
        service.confirm(TENANT_ID, { key: VALID_KEY, exerciseId: EXERCISE_ID }),
      ).rejects.toBe(notFound);

      const deleteCalls = s3.send.mock.calls.filter(
        ([cmd]) => cmd instanceof DeleteObjectCommand,
      );
      expect(deleteCalls).toHaveLength(1);
    });

    it('si el storage no está configurado → 503 MEDIA_NOT_CONFIGURED', async () => {
      const notConfigured = new MediaService(
        s3 as unknown as ConstructorParameters<typeof MediaService>[0],
        null,
        exercisesService as unknown as ExercisesService,
      );
      await expect(
        notConfigured.confirm(TENANT_ID, {
          key: VALID_KEY,
          exerciseId: EXERCISE_ID,
        }),
      ).rejects.toMatchObject({
        response: { code: 'MEDIA_NOT_CONFIGURED' },
      });
    });
  });
});
