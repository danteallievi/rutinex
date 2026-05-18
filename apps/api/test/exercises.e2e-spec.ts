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
import { Tenant } from './../src/modules/tenants/entities/tenant.entity';
import { User } from './../src/modules/users/entities/user.entity';
import { UsersService } from './../src/modules/users/users.service';

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

interface ExerciseResponseBody {
  id: string;
  title: string;
  description: string;
  mediaUrl: string | null;
  mediaType: 'video' | 'gif' | 'image' | 'none';
  muscleGroups: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedExercisesBody {
  data: ExerciseResponseBody[];
  page: number;
  pageSize: number;
  total: number;
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

describe('Exercises CRUD — Step 14 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersService: UsersService;
  let passwordService: PasswordService;

  let tenantA: Tenant;
  let ownerA: User;
  let trainerA: User;
  let studentA: User;

  let tenantB: Tenant;
  let ownerB: User;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

  // helpers -------------------------------------------------------------------

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

  const createExerciseAs = async (
    accessToken: string,
    slug: string,
    body: Record<string, unknown>,
  ): Promise<ExerciseResponseBody> => {
    const res = await request(app.getHttpServer())
      .post('/exercises')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-slug', slug)
      .send(body)
      .expect(201);
    return res.body as ExerciseResponseBody;
  };

  // --------------------------------------------------------------------------
  // POST /exercises
  // --------------------------------------------------------------------------
  describe('POST /exercises', () => {
    it('OWNER crea exercise (mediaType=none) → 201 con createdBy = owner.id', async () => {
      const { accessToken } = await loginOwnerA();
      const body = await createExerciseAs(accessToken, TENANT_A_SLUG, {
        title: 'Press de banca',
        mediaType: 'none',
        muscleGroups: ['chest', 'triceps'],
      });
      expect(body.title).toBe('Press de banca');
      expect(body.mediaType).toBe('none');
      expect(body.mediaUrl).toBeNull();
      expect(body.muscleGroups).toEqual(['chest', 'triceps']);
      expect(body.createdBy).toBe(ownerA.id);
      expect(body.description).toBe('');
    });

    it('TRAINER crea exercise con media video → 201', async () => {
      const { accessToken } = await loginTrainerA();
      const body = await createExerciseAs(accessToken, TENANT_A_SLUG, {
        title: 'Sentadilla',
        description: 'Bajada controlada.',
        mediaType: 'video',
        mediaUrl: 'https://r2.test/sentadilla.mp4',
        muscleGroups: ['quads', 'glutes'],
      });
      expect(body.mediaType).toBe('video');
      expect(body.mediaUrl).toBe('https://r2.test/sentadilla.mp4');
      expect(body.createdBy).toBe(trainerA.id);
    });

    it('STUDENT intenta crear → 403 FORBIDDEN_ROLE', async () => {
      const { accessToken } = await loginStudentA();
      const res = await request(app.getHttpServer())
        .post('/exercises')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ title: 'X', mediaType: 'none' })
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
    });

    it('mediaType=video sin mediaUrl → 400 EXERCISE_MEDIA_INCONSISTENT', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post('/exercises')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ title: 'X', mediaType: 'video' })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('EXERCISE_MEDIA_INCONSISTENT');
    });

    it('mediaType=none + mediaUrl → 400 EXERCISE_MEDIA_INCONSISTENT', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post('/exercises')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          title: 'X',
          mediaType: 'none',
          mediaUrl: 'https://r2.test/x.mp4',
        })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('EXERCISE_MEDIA_INCONSISTENT');
    });

    it('URL inválida (sin protocolo) → 400 (DTO)', async () => {
      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .post('/exercises')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          title: 'X',
          mediaType: 'video',
          mediaUrl: 'r2.test/x.mp4',
        })
        .expect(400);
    });

    it('DTO inválido (sin title) → 400', async () => {
      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .post('/exercises')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ mediaType: 'none' })
        .expect(400);
    });

    it('Propiedad no-whitelisteada → 400', async () => {
      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .post('/exercises')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ title: 'X', mediaType: 'none', extra: 'no' })
        .expect(400);
    });

    it('sin x-tenant-slug → 400 TENANT_SLUG_REQUIRED', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post('/exercises')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'X', mediaType: 'none' })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('TENANT_SLUG_REQUIRED');
    });
  });

  // --------------------------------------------------------------------------
  // GET /exercises (list)
  // --------------------------------------------------------------------------
  describe('GET /exercises', () => {
    it('STUDENT puede listar el catálogo del tenant', async () => {
      const ownerLogin = await loginOwnerA();
      await createExerciseAs(ownerLogin.accessToken, TENANT_A_SLUG, {
        title: 'Press de banca',
        mediaType: 'none',
        muscleGroups: ['chest', 'triceps'],
      });
      await createExerciseAs(ownerLogin.accessToken, TENANT_A_SLUG, {
        title: 'Sentadilla',
        mediaType: 'none',
        muscleGroups: ['quads'],
      });

      const studentLogin = await loginStudentA();
      const res = await request(app.getHttpServer())
        .get('/exercises')
        .set('Authorization', `Bearer ${studentLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as PaginatedExercisesBody;
      expect(body.total).toBe(2);
      expect(body.data.length).toBe(2);
      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(20);
    });

    it('Filtro q="press" matchea ILIKE en title', async () => {
      const { accessToken } = await loginOwnerA();
      await createExerciseAs(accessToken, TENANT_A_SLUG, {
        title: 'Press de banca',
        mediaType: 'none',
        muscleGroups: ['chest'],
      });
      await createExerciseAs(accessToken, TENANT_A_SLUG, {
        title: 'Sentadilla',
        mediaType: 'none',
        muscleGroups: ['quads'],
      });

      const res = await request(app.getHttpServer())
        .get('/exercises?q=press')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as PaginatedExercisesBody;
      expect(body.total).toBe(1);
      expect(body.data[0]!.title).toBe('Press de banca');
    });

    it('Filtro muscleGroups=chest filtra por overlap', async () => {
      const { accessToken } = await loginOwnerA();
      await createExerciseAs(accessToken, TENANT_A_SLUG, {
        title: 'Press de banca',
        mediaType: 'none',
        muscleGroups: ['chest', 'triceps'],
      });
      await createExerciseAs(accessToken, TENANT_A_SLUG, {
        title: 'Sentadilla',
        mediaType: 'none',
        muscleGroups: ['quads'],
      });

      const res = await request(app.getHttpServer())
        .get('/exercises?muscleGroups=chest')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as PaginatedExercisesBody;
      expect(body.total).toBe(1);
      expect(body.data[0]!.title).toBe('Press de banca');
    });

    it('Filtros combinados q + muscleGroups (CSV)', async () => {
      const { accessToken } = await loginOwnerA();
      await createExerciseAs(accessToken, TENANT_A_SLUG, {
        title: 'Press de banca',
        mediaType: 'none',
        muscleGroups: ['chest'],
      });
      await createExerciseAs(accessToken, TENANT_A_SLUG, {
        title: 'Press militar',
        mediaType: 'none',
        muscleGroups: ['shoulders'],
      });
      await createExerciseAs(accessToken, TENANT_A_SLUG, {
        title: 'Sentadilla',
        mediaType: 'none',
        muscleGroups: ['quads'],
      });

      const res = await request(app.getHttpServer())
        .get('/exercises?q=press&muscleGroups=chest,shoulders')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as PaginatedExercisesBody;
      expect(body.total).toBe(2);
    });

    it('Paginación page=1 pageSize=1 → 1 item, total exacto', async () => {
      const { accessToken } = await loginOwnerA();
      await createExerciseAs(accessToken, TENANT_A_SLUG, {
        title: 'A',
        mediaType: 'none',
      });
      await createExerciseAs(accessToken, TENANT_A_SLUG, {
        title: 'B',
        mediaType: 'none',
      });

      const res = await request(app.getHttpServer())
        .get('/exercises?page=1&pageSize=1')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as PaginatedExercisesBody;
      expect(body.total).toBe(2);
      expect(body.data.length).toBe(1);
    });

    it('No ve exercises de otro tenant', async () => {
      // Crear exercise en tenant A
      const ownerALogin = await loginOwnerA();
      await createExerciseAs(ownerALogin.accessToken, TENANT_A_SLUG, {
        title: 'Press olimpo',
        mediaType: 'none',
      });
      // Crear exercise en tenant B
      const ownerBLogin = await loginOwnerB();
      await createExerciseAs(ownerBLogin.accessToken, TENANT_B_SLUG, {
        title: 'Press spartan',
        mediaType: 'none',
      });

      // Listar desde A → solo el de A
      const res = await request(app.getHttpServer())
        .get('/exercises')
        .set('Authorization', `Bearer ${ownerALogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as PaginatedExercisesBody;
      expect(body.total).toBe(1);
      expect(body.data[0]!.title).toBe('Press olimpo');
    });
  });

  // --------------------------------------------------------------------------
  // GET /exercises/:id
  // --------------------------------------------------------------------------
  describe('GET /exercises/:id', () => {
    it('STUDENT puede leer detalle', async () => {
      const ownerLogin = await loginOwnerA();
      const created = await createExerciseAs(
        ownerLogin.accessToken,
        TENANT_A_SLUG,
        { title: 'Press', mediaType: 'none' },
      );

      const studentLogin = await loginStudentA();
      const res = await request(app.getHttpServer())
        .get(`/exercises/${created.id}`)
        .set('Authorization', `Bearer ${studentLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      expect((res.body as ExerciseResponseBody).id).toBe(created.id);
    });

    it('id inexistente → 404 EXERCISE_NOT_FOUND', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .get('/exercises/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('EXERCISE_NOT_FOUND');
    });

    it('id no-UUID → 400 (ParseUUIDPipe)', async () => {
      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .get('/exercises/no-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(400);
    });

    it('Cross-tenant: OWNER de A pidiendo exercise de B → 404 (no filtra existencia)', async () => {
      const ownerBLogin = await loginOwnerB();
      const created = await createExerciseAs(
        ownerBLogin.accessToken,
        TENANT_B_SLUG,
        { title: 'Press spartan', mediaType: 'none' },
      );

      const ownerALogin = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .get(`/exercises/${created.id}`)
        .set('Authorization', `Bearer ${ownerALogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('EXERCISE_NOT_FOUND');
    });
  });

  // --------------------------------------------------------------------------
  // PATCH /exercises/:id
  // --------------------------------------------------------------------------
  describe('PATCH /exercises/:id', () => {
    it('OWNER actualiza title → 200', async () => {
      const { accessToken } = await loginOwnerA();
      const created = await createExerciseAs(accessToken, TENANT_A_SLUG, {
        title: 'Press',
        mediaType: 'none',
      });
      const res = await request(app.getHttpServer())
        .patch(`/exercises/${created.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ title: 'Press inclinado' })
        .expect(200);
      expect((res.body as ExerciseResponseBody).title).toBe('Press inclinado');
    });

    it('TRAINER actualiza muscleGroups → 200', async () => {
      const ownerLogin = await loginOwnerA();
      const created = await createExerciseAs(
        ownerLogin.accessToken,
        TENANT_A_SLUG,
        { title: 'Press', mediaType: 'none', muscleGroups: ['chest'] },
      );

      const trainerLogin = await loginTrainerA();
      const res = await request(app.getHttpServer())
        .patch(`/exercises/${created.id}`)
        .set('Authorization', `Bearer ${trainerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ muscleGroups: ['chest', 'triceps'] })
        .expect(200);
      expect((res.body as ExerciseResponseBody).muscleGroups).toEqual([
        'chest',
        'triceps',
      ]);
    });

    it('STUDENT intenta editar → 403 FORBIDDEN_ROLE', async () => {
      const ownerLogin = await loginOwnerA();
      const created = await createExerciseAs(
        ownerLogin.accessToken,
        TENANT_A_SLUG,
        { title: 'Press', mediaType: 'none' },
      );

      const studentLogin = await loginStudentA();
      const res = await request(app.getHttpServer())
        .patch(`/exercises/${created.id}`)
        .set('Authorization', `Bearer ${studentLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ title: 'X' })
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
    });

    it('cambiar mediaType=video sin mediaUrl → 400 EXERCISE_MEDIA_INCONSISTENT', async () => {
      const { accessToken } = await loginOwnerA();
      const created = await createExerciseAs(accessToken, TENANT_A_SLUG, {
        title: 'Press',
        mediaType: 'none',
      });
      const res = await request(app.getHttpServer())
        .patch(`/exercises/${created.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ mediaType: 'video' })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('EXERCISE_MEDIA_INCONSISTENT');
    });

    it('cambiar mediaType=video + mediaUrl en el mismo PATCH → 200', async () => {
      const { accessToken } = await loginOwnerA();
      const created = await createExerciseAs(accessToken, TENANT_A_SLUG, {
        title: 'Press',
        mediaType: 'none',
      });
      const res = await request(app.getHttpServer())
        .patch(`/exercises/${created.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          mediaType: 'video',
          mediaUrl: 'https://r2.test/x.mp4',
        })
        .expect(200);
      expect((res.body as ExerciseResponseBody).mediaType).toBe('video');
      expect((res.body as ExerciseResponseBody).mediaUrl).toBe(
        'https://r2.test/x.mp4',
      );
    });

    it('cambiar mediaType=none + mediaUrl=null → limpia media', async () => {
      const { accessToken } = await loginOwnerA();
      const created = await createExerciseAs(accessToken, TENANT_A_SLUG, {
        title: 'Press',
        mediaType: 'video',
        mediaUrl: 'https://r2.test/x.mp4',
      });
      const res = await request(app.getHttpServer())
        .patch(`/exercises/${created.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ mediaType: 'none', mediaUrl: null })
        .expect(200);
      expect((res.body as ExerciseResponseBody).mediaType).toBe('none');
      expect((res.body as ExerciseResponseBody).mediaUrl).toBeNull();
    });

    it('inexistente → 404', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .patch('/exercises/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ title: 'X' })
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('EXERCISE_NOT_FOUND');
    });

    it('Cross-tenant: OWNER de A patchando id de B → 404 (no filtra existencia)', async () => {
      const ownerBLogin = await loginOwnerB();
      const created = await createExerciseAs(
        ownerBLogin.accessToken,
        TENANT_B_SLUG,
        { title: 'X', mediaType: 'none' },
      );

      const ownerALogin = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .patch(`/exercises/${created.id}`)
        .set('Authorization', `Bearer ${ownerALogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ title: 'Hack' })
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('EXERCISE_NOT_FOUND');
    });
  });

  // --------------------------------------------------------------------------
  // DELETE /exercises/:id
  // --------------------------------------------------------------------------
  describe('DELETE /exercises/:id', () => {
    it('OWNER borra → 204 (hard delete)', async () => {
      const { accessToken } = await loginOwnerA();
      const created = await createExerciseAs(accessToken, TENANT_A_SLUG, {
        title: 'Press',
        mediaType: 'none',
      });
      await request(app.getHttpServer())
        .delete(`/exercises/${created.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(204);

      const row = await dataSource
        .getRepository(Exercise)
        .findOne({ where: { id: created.id } });
      expect(row).toBeNull();
    });

    it('TRAINER borra → 204', async () => {
      const ownerLogin = await loginOwnerA();
      const created = await createExerciseAs(
        ownerLogin.accessToken,
        TENANT_A_SLUG,
        { title: 'Press', mediaType: 'none' },
      );

      const trainerLogin = await loginTrainerA();
      await request(app.getHttpServer())
        .delete(`/exercises/${created.id}`)
        .set('Authorization', `Bearer ${trainerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(204);
    });

    it('STUDENT intenta borrar → 403 FORBIDDEN_ROLE', async () => {
      const ownerLogin = await loginOwnerA();
      const created = await createExerciseAs(
        ownerLogin.accessToken,
        TENANT_A_SLUG,
        { title: 'Press', mediaType: 'none' },
      );

      const studentLogin = await loginStudentA();
      const res = await request(app.getHttpServer())
        .delete(`/exercises/${created.id}`)
        .set('Authorization', `Bearer ${studentLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
    });

    it('inexistente → 404', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .delete('/exercises/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('EXERCISE_NOT_FOUND');
    });

    it('Cross-tenant: OWNER de A borrando id de B → 404', async () => {
      const ownerBLogin = await loginOwnerB();
      const created = await createExerciseAs(
        ownerBLogin.accessToken,
        TENANT_B_SLUG,
        { title: 'X', mediaType: 'none' },
      );

      const ownerALogin = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .delete(`/exercises/${created.id}`)
        .set('Authorization', `Bearer ${ownerALogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('EXERCISE_NOT_FOUND');

      // Verificar que el exercise sigue en B
      const row = await dataSource
        .getRepository(Exercise)
        .findOne({ where: { id: created.id } });
      expect(row).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------
  describe('auth requerido', () => {
    it('GET sin bearer → 401', async () => {
      await request(app.getHttpServer())
        .get('/exercises')
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(401);
    });

    it('POST sin bearer → 401', async () => {
      await request(app.getHttpServer())
        .post('/exercises')
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ title: 'X', mediaType: 'none' })
        .expect(401);
    });
  });
});
