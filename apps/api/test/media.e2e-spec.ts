import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { PasswordService } from './../src/modules/auth/password.service';
import { seedSuperadmin } from './../src/modules/auth/seed-superadmin';
import { Exercise } from './../src/modules/exercises/entities/exercise.entity';
import {
  R2_CLIENT,
  R2_CONFIG,
  type R2Config,
} from './../src/modules/media/r2.config';
import { Tenant } from './../src/modules/tenants/entities/tenant.entity';
import { User } from './../src/modules/users/entities/user.entity';
import { UsersService } from './../src/modules/users/users.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const getSignedUrlMock = getSignedUrl as jest.MockedFunction<
  typeof getSignedUrl
>;

interface LoginResponseBody {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    role: 'OWNER' | 'TRAINER' | 'STUDENT' | null;
    isSuperadmin: boolean;
    mustChangePassword: boolean;
    tenant: { id: string; slug: string } | null;
  };
}

interface UploadUrlBody {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresAt: string;
  contentType: string;
}

interface ConfirmBody {
  exercise: {
    id: string;
    mediaType: 'video' | 'gif' | 'image' | 'none';
    mediaUrl: string | null;
  };
}

interface ErrorBody {
  statusCode: number;
  code?: string;
  message?: string | string[];
}

const SUPERADMIN_EMAIL = 'super@rutinex.app';
const SUPERADMIN_PASSWORD = 'una-password-segura-larga';
const TENANT_A_HOST = 'olimpo.rutinex.app';
const TENANT_A_SLUG = 'olimpo';
const TENANT_B_HOST = 'spartan.rutinex.app';
const TENANT_B_SLUG = 'spartan';
const OWNER_PASSWORD = 'owner-password-1234';
const TRAINER_PASSWORD = 'trainer-password-1234';

const R2_CONFIG_MOCK: R2Config = {
  bucket: 'rutinex-media-test',
  publicUrl: 'https://media.rutinex.test',
  presignTtlSeconds: 300,
};

const SIGNED_URL = 'https://signed.example/upload?sig=abc';

describe('Media (R2) — Step 15 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersService: UsersService;
  let passwordService: PasswordService;
  let s3SendMock: jest.Mock;

  let tenantA: Tenant;
  let ownerA: User;
  let trainerA: User;
  let studentA: User;

  let tenantB: Tenant;
  let ownerB: User;

  beforeAll(async () => {
    s3SendMock = jest.fn();
    const fakeS3 = { send: s3SendMock } as unknown as S3Client;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(R2_CLIENT)
      .useValue(fakeS3)
      .overrideProvider(R2_CONFIG)
      .useValue(R2_CONFIG_MOCK)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    dataSource = app.get(DataSource);
    usersService = app.get(UsersService);
    passwordService = app.get(PasswordService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    getSignedUrlMock.mockResolvedValue(SIGNED_URL);

    await dataSource.query(
      'TRUNCATE TABLE "exercises", "refresh_tokens", "users", "tenants" CASCADE',
    );

    await seedSuperadmin(usersService, passwordService, {
      email: SUPERADMIN_EMAIL,
      password: SUPERADMIN_PASSWORD,
    });

    const tenantRepo = dataSource.getRepository(Tenant);
    tenantA = await tenantRepo.save(
      tenantRepo.create({
        slug: TENANT_A_SLUG,
        name: 'Gimnasio Olimpo',
        branding: {},
        isActive: true,
      }),
    );
    tenantB = await tenantRepo.save(
      tenantRepo.create({
        slug: TENANT_B_SLUG,
        name: 'Spartan Athletic',
        branding: {},
        isActive: true,
      }),
    );

    ownerA = await usersService.create({
      tenantId: tenantA.id,
      role: 'OWNER',
      email: 'owner@olimpo.test',
      passwordHash: await passwordService.hash(OWNER_PASSWORD),
      firstName: 'Olga',
      lastName: 'Owner',
    });
    trainerA = await usersService.create({
      tenantId: tenantA.id,
      role: 'TRAINER',
      email: 'trainer@olimpo.test',
      passwordHash: await passwordService.hash(TRAINER_PASSWORD),
      firstName: 'Tomi',
      lastName: 'Trainer',
    });
    studentA = await usersService.create({
      tenantId: tenantA.id,
      role: 'STUDENT',
      dni: '11111111',
      firstName: 'Estu',
      lastName: 'Diante',
      trainerId: trainerA.id,
    });
    ownerB = await usersService.create({
      tenantId: tenantB.id,
      role: 'OWNER',
      email: 'owner@spartan.test',
      passwordHash: await passwordService.hash(OWNER_PASSWORD),
      firstName: 'Owner',
      lastName: 'B',
    });
  });

  // helpers -----------------------------------------------------------------

  const loginAs = async (
    host: string,
    body: Record<string, string>,
    endpoint: '/auth/login' | '/auth/student-login' = '/auth/login',
  ): Promise<LoginResponseBody> => {
    const res = await request(app.getHttpServer())
      .post(endpoint)
      .set('Host', host)
      .send(body)
      .expect(200);
    return res.body as LoginResponseBody;
  };

  const loginOwnerA = (): Promise<LoginResponseBody> =>
    loginAs(TENANT_A_HOST, { email: ownerA.email!, password: OWNER_PASSWORD });
  const loginTrainerA = (): Promise<LoginResponseBody> =>
    loginAs(TENANT_A_HOST, {
      email: trainerA.email!,
      password: TRAINER_PASSWORD,
    });
  const loginStudentA = (): Promise<LoginResponseBody> =>
    loginAs(TENANT_A_HOST, { dni: studentA.dni! }, '/auth/student-login');
  const loginOwnerB = (): Promise<LoginResponseBody> =>
    loginAs(TENANT_B_HOST, { email: ownerB.email!, password: OWNER_PASSWORD });

  const createExercise = async (
    accessToken: string,
    slug: string,
    body: Record<string, unknown>,
  ): Promise<{ id: string }> => {
    const res = await request(app.getHttpServer())
      .post('/exercises')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-slug', slug)
      .send(body)
      .expect(201);
    return res.body as { id: string };
  };

  // --------------------------------------------------------------------------
  // POST /media/upload-url
  // --------------------------------------------------------------------------
  describe('POST /media/upload-url', () => {
    it('OWNER pide presign para video/mp4 → 200 con key bajo tenants/<tenantA.id>/exercises', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post('/media/upload-url')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ kind: 'video', contentType: 'video/mp4', sizeBytes: 1024 })
        .expect(200);
      const body = res.body as UploadUrlBody;
      expect(body.uploadUrl).toBe(SIGNED_URL);
      expect(body.contentType).toBe('video/mp4');
      expect(body.key).toMatch(
        new RegExp(`^tenants/${tenantA.id}/exercises/[0-9a-f-]+\\.mp4$`),
      );
      expect(body.publicUrl).toBe(`${R2_CONFIG_MOCK.publicUrl}/${body.key}`);
      expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());

      expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
      const [, command] = getSignedUrlMock.mock.calls[0]!;
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect((command as PutObjectCommand).input.Bucket).toBe(
        R2_CONFIG_MOCK.bucket,
      );
      expect((command as PutObjectCommand).input.ContentType).toBe('video/mp4');
    });

    it('TRAINER puede pedir presign → 200', async () => {
      const { accessToken } = await loginTrainerA();
      await request(app.getHttpServer())
        .post('/media/upload-url')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ kind: 'gif', contentType: 'image/gif', sizeBytes: 2048 })
        .expect(200);
    });

    it('STUDENT no puede pedir presign → 403 FORBIDDEN_ROLE', async () => {
      const { accessToken } = await loginStudentA();
      const res = await request(app.getHttpServer())
        .post('/media/upload-url')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ kind: 'image', contentType: 'image/png', sizeBytes: 100 })
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
    });

    it('contentType no permitido → 400 MEDIA_CONTENT_TYPE_NOT_ALLOWED', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post('/media/upload-url')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ kind: 'image', contentType: 'image/heic', sizeBytes: 100 })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe(
        'MEDIA_CONTENT_TYPE_NOT_ALLOWED',
      );
      expect(getSignedUrlMock).not.toHaveBeenCalled();
    });

    it('sizeBytes > límite del kind → 400 MEDIA_SIZE_EXCEEDED', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post('/media/upload-url')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          kind: 'video',
          contentType: 'video/mp4',
          sizeBytes: 100 * 1024 * 1024,
        })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('MEDIA_SIZE_EXCEEDED');
    });

    it('kind inválido → 400 (DTO @IsIn)', async () => {
      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .post('/media/upload-url')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ kind: 'pdf', contentType: 'application/pdf', sizeBytes: 100 })
        .expect(400);
    });

    it('sin x-tenant-slug → 400 TENANT_SLUG_REQUIRED', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post('/media/upload-url')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ kind: 'image', contentType: 'image/png', sizeBytes: 100 })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('TENANT_SLUG_REQUIRED');
    });

    it('sin auth → 401', async () => {
      await request(app.getHttpServer())
        .post('/media/upload-url')
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ kind: 'image', contentType: 'image/png', sizeBytes: 100 })
        .expect(401);
    });

    it('cross-tenant: la key emitida lleva el tenantId del JWT, no el del header', async () => {
      // OWNER de A → key debe llevar tenantA.id, no tenantB.id, aunque el
      // slug del header sea de su propio tenant (no es posible llamar con un
      // slug ajeno: el TenantGuard rechaza). Esto verifica el binding del JWT.
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post('/media/upload-url')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ kind: 'image', contentType: 'image/png', sizeBytes: 100 })
        .expect(200);
      const body = res.body as UploadUrlBody;
      expect(body.key.startsWith(`tenants/${tenantA.id}/`)).toBe(true);
      expect(body.key.includes(tenantB.id)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // POST /media/confirm
  // --------------------------------------------------------------------------
  describe('POST /media/confirm', () => {
    it('confirma upload válido y persiste mediaUrl en el exercise', async () => {
      const ownerLogin = await loginOwnerA();
      const { id: exerciseId } = await createExercise(
        ownerLogin.accessToken,
        TENANT_A_SLUG,
        { title: 'Press', mediaType: 'none' },
      );
      const key = `tenants/${tenantA.id}/exercises/abc.mp4`;

      s3SendMock.mockImplementation((cmd: unknown) => {
        if (cmd instanceof HeadObjectCommand) {
          return Promise.resolve({
            ContentType: 'video/mp4',
            ContentLength: 5 * 1024 * 1024,
          });
        }
        return Promise.resolve({});
      });

      const res = await request(app.getHttpServer())
        .post('/media/confirm')
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ key, exerciseId })
        .expect(200);
      const body = res.body as ConfirmBody;
      expect(body.exercise.id).toBe(exerciseId);
      expect(body.exercise.mediaType).toBe('video');
      expect(body.exercise.mediaUrl).toBe(`${R2_CONFIG_MOCK.publicUrl}/${key}`);

      const persisted = await dataSource
        .getRepository(Exercise)
        .findOneByOrFail({ id: exerciseId });
      expect(persisted.mediaType).toBe('video');
      expect(persisted.mediaUrl).toBe(`${R2_CONFIG_MOCK.publicUrl}/${key}`);
    });

    it('key con prefijo de otro tenant → 400 MEDIA_KEY_NOT_OWNED', async () => {
      const ownerLogin = await loginOwnerA();
      const { id: exerciseId } = await createExercise(
        ownerLogin.accessToken,
        TENANT_A_SLUG,
        { title: 'Press', mediaType: 'none' },
      );
      const res = await request(app.getHttpServer())
        .post('/media/confirm')
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          key: `tenants/${tenantB.id}/exercises/abc.mp4`,
          exerciseId,
        })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('MEDIA_KEY_NOT_OWNED');
      expect(s3SendMock).not.toHaveBeenCalled();
    });

    it('objeto inexistente en R2 → 400 MEDIA_OBJECT_NOT_FOUND', async () => {
      const ownerLogin = await loginOwnerA();
      const { id: exerciseId } = await createExercise(
        ownerLogin.accessToken,
        TENANT_A_SLUG,
        { title: 'Press', mediaType: 'none' },
      );
      s3SendMock.mockRejectedValueOnce(
        Object.assign(new Error('not found'), {
          name: 'NotFound',
          $metadata: { httpStatusCode: 404 },
        }),
      );
      const res = await request(app.getHttpServer())
        .post('/media/confirm')
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          key: `tenants/${tenantA.id}/exercises/abc.mp4`,
          exerciseId,
        })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('MEDIA_OBJECT_NOT_FOUND');
    });

    it('size real > límite → 400 MEDIA_SIZE_EXCEEDED y borra el blob', async () => {
      const ownerLogin = await loginOwnerA();
      const { id: exerciseId } = await createExercise(
        ownerLogin.accessToken,
        TENANT_A_SLUG,
        { title: 'Press', mediaType: 'none' },
      );
      const key = `tenants/${tenantA.id}/exercises/abc.mp4`;
      s3SendMock.mockImplementation((cmd: unknown) => {
        if (cmd instanceof HeadObjectCommand) {
          return Promise.resolve({
            ContentType: 'video/mp4',
            ContentLength: 60 * 1024 * 1024,
          });
        }
        if (cmd instanceof DeleteObjectCommand) {
          return Promise.resolve({});
        }
        return Promise.resolve({});
      });

      const res = await request(app.getHttpServer())
        .post('/media/confirm')
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ key, exerciseId })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('MEDIA_SIZE_EXCEEDED');

      const deletes = s3SendMock.mock.calls.filter(
        (call) => (call as unknown[])[0] instanceof DeleteObjectCommand,
      ) as [DeleteObjectCommand][];
      expect(deletes).toHaveLength(1);
      expect(deletes[0]![0].input.Key).toBe(key);

      const persisted = await dataSource
        .getRepository(Exercise)
        .findOneByOrFail({ id: exerciseId });
      expect(persisted.mediaUrl).toBeNull();
    });

    it('exercise no existe en el tenant → 404 EXERCISE_NOT_FOUND y borra el blob', async () => {
      const ownerLogin = await loginOwnerA();
      const fakeExerciseId = '00000000-0000-0000-0000-000000000000';
      const key = `tenants/${tenantA.id}/exercises/abc.mp4`;

      s3SendMock.mockImplementation((cmd: unknown) => {
        if (cmd instanceof HeadObjectCommand) {
          return Promise.resolve({
            ContentType: 'video/mp4',
            ContentLength: 5 * 1024 * 1024,
          });
        }
        if (cmd instanceof DeleteObjectCommand) {
          return Promise.resolve({});
        }
        return Promise.resolve({});
      });

      const res = await request(app.getHttpServer())
        .post('/media/confirm')
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ key, exerciseId: fakeExerciseId })
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('EXERCISE_NOT_FOUND');

      const deletes = s3SendMock.mock.calls.filter(
        ([cmd]) => cmd instanceof DeleteObjectCommand,
      );
      expect(deletes).toHaveLength(1);
    });

    it('cross-tenant: exercise de tenant B no es alcanzable desde tenant A → 404 + borra', async () => {
      // Crear exercise en tenant B
      const ownerBLogin = await loginOwnerB();
      const { id: exerciseBId } = await createExercise(
        ownerBLogin.accessToken,
        TENANT_B_SLUG,
        { title: 'Press B', mediaType: 'none' },
      );
      // OWNER de A intenta confirmar contra el exerciseBId pero su key es de A
      const ownerALogin = await loginOwnerA();
      const key = `tenants/${tenantA.id}/exercises/abc.mp4`;
      s3SendMock.mockImplementation((cmd: unknown) => {
        if (cmd instanceof HeadObjectCommand) {
          return Promise.resolve({
            ContentType: 'video/mp4',
            ContentLength: 5 * 1024 * 1024,
          });
        }
        if (cmd instanceof DeleteObjectCommand) {
          return Promise.resolve({});
        }
        return Promise.resolve({});
      });
      const res = await request(app.getHttpServer())
        .post('/media/confirm')
        .set('Authorization', `Bearer ${ownerALogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ key, exerciseId: exerciseBId })
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('EXERCISE_NOT_FOUND');
    });

    it('STUDENT no puede confirmar → 403 FORBIDDEN_ROLE', async () => {
      const studentLogin = await loginStudentA();
      const res = await request(app.getHttpServer())
        .post('/media/confirm')
        .set('Authorization', `Bearer ${studentLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          key: `tenants/${tenantA.id}/exercises/abc.mp4`,
          exerciseId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
      expect(s3SendMock).not.toHaveBeenCalled();
    });

    it('sin auth → 401', async () => {
      await request(app.getHttpServer())
        .post('/media/confirm')
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          key: `tenants/${tenantA.id}/exercises/abc.mp4`,
          exerciseId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(401);
    });
  });
});
