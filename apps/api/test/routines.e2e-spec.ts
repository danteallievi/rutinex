import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { PasswordService } from './../src/modules/auth/password.service';
import { seedSuperadmin } from './../src/modules/auth/seed-superadmin';
import type { ExerciseMediaType } from './../src/modules/exercises/entities/exercise.entity';
import { ExercisesService } from './../src/modules/exercises/exercises.service';
import { RoutineItem } from './../src/modules/routines/entities/routine-item.entity';
import { Routine } from './../src/modules/routines/entities/routine.entity';
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

interface RoutineItemResponseBody {
  id: string;
  exerciseId: string;
  position: number;
  prescribedSets: number;
  prescribedReps: string;
  prescribedWeight: string | null;
  restSeconds: number | null;
  notes: string | null;
  exercise: {
    id: string;
    title: string;
    mediaType: ExerciseMediaType;
  };
}

interface RoutineResponseBody {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: RoutineItemResponseBody[];
}

interface RoutineListItemBody {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  itemsCount: number;
}

interface PaginatedRoutinesBody {
  data: RoutineListItemBody[];
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

describe('Routines CRUD — Step 16 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersService: UsersService;
  let passwordService: PasswordService;
  let exercisesService: ExercisesService;

  let tenantA: Tenant;
  let ownerA: User;
  let trainerA: User;
  let studentA: User;

  let tenantB: Tenant;
  let ownerB: User;

  let exerciseA1Id: string;
  let exerciseA2Id: string;
  let exerciseB1Id: string;

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
    exercisesService = app.get(ExercisesService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "routine_items", "routines", "exercises", "refresh_tokens", "users", "tenants" CASCADE',
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

    // Seed exercises (vía service real para que respeten el flow tenant-scoped)
    const ex1 = await exercisesService.create(tenantA.id, ownerA.id, {
      title: 'Press de banca',
      mediaType: 'none',
      muscleGroups: ['chest'],
    });
    exerciseA1Id = ex1.id;
    const ex2 = await exercisesService.create(tenantA.id, ownerA.id, {
      title: 'Sentadilla',
      mediaType: 'none',
      muscleGroups: ['quads'],
    });
    exerciseA2Id = ex2.id;
    const exB = await exercisesService.create(tenantB.id, ownerB.id, {
      title: 'Press spartan',
      mediaType: 'none',
      muscleGroups: ['chest'],
    });
    exerciseB1Id = exB.id;
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

  const createRoutineAs = async (
    accessToken: string,
    slug: string,
    body: Record<string, unknown>,
  ): Promise<RoutineResponseBody> => {
    const res = await request(app.getHttpServer())
      .post('/routines')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-slug', slug)
      .send(body)
      .expect(201);
    return res.body as RoutineResponseBody;
  };

  // --------------------------------------------------------------------------
  // POST /routines
  // --------------------------------------------------------------------------
  describe('POST /routines', () => {
    it('OWNER crea routine con 2 items → 201, items ordenados por position', async () => {
      const { accessToken } = await loginOwnerA();
      const body = await createRoutineAs(accessToken, TENANT_A_SLUG, {
        name: 'Tren superior',
        description: 'Lunes',
        items: [
          {
            exerciseId: exerciseA1Id,
            position: 2,
            prescribedSets: 4,
            prescribedReps: '8',
            prescribedWeight: '70kg',
            restSeconds: 90,
          },
          {
            exerciseId: exerciseA2Id,
            position: 1,
            prescribedSets: 3,
            prescribedReps: '10',
          },
        ],
      });
      expect(body.name).toBe('Tren superior');
      expect(body.description).toBe('Lunes');
      expect(body.createdBy).toBe(ownerA.id);
      expect(body.items.length).toBe(2);
      expect(body.items.map((i) => i.position)).toEqual([1, 2]);
      // El primero (sentadilla) por position=1 en input.
      expect(body.items[0]!.exerciseId).toBe(exerciseA2Id);
      expect(body.items[0]!.exercise.title).toBe('Sentadilla');
      expect(body.items[1]!.exerciseId).toBe(exerciseA1Id);
      expect(body.items[1]!.exercise.title).toBe('Press de banca');
      expect(body.items[1]!.prescribedWeight).toBe('70kg');
      expect(body.items[1]!.restSeconds).toBe(90);
    });

    it('TRAINER crea routine → 201', async () => {
      const { accessToken } = await loginTrainerA();
      const body = await createRoutineAs(accessToken, TENANT_A_SLUG, {
        name: 'Mini',
        items: [
          {
            exerciseId: exerciseA1Id,
            position: 1,
            prescribedSets: 3,
            prescribedReps: '8-10',
          },
        ],
      });
      expect(body.createdBy).toBe(trainerA.id);
      expect(body.items.length).toBe(1);
    });

    it('STUDENT intenta crear → 403 FORBIDDEN_ROLE', async () => {
      const { accessToken } = await loginStudentA();
      const res = await request(app.getHttpServer())
        .post('/routines')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          name: 'X',
          items: [
            {
              exerciseId: exerciseA1Id,
              position: 1,
              prescribedSets: 1,
              prescribedReps: '1',
            },
          ],
        })
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
    });

    it('items vacío → 400 (DTO @ArrayMinSize)', async () => {
      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .post('/routines')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ name: 'Vacía', items: [] })
        .expect(400);
    });

    it('exerciseId de otro tenant → 400 ROUTINE_ITEM_EXERCISE_NOT_FOUND', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post('/routines')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          name: 'Cross',
          items: [
            {
              exerciseId: exerciseB1Id,
              position: 1,
              prescribedSets: 3,
              prescribedReps: '10',
            },
          ],
        })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe(
        'ROUTINE_ITEM_EXERCISE_NOT_FOUND',
      );

      // Verificar que no quedó routine huérfana (transacción).
      const count = await dataSource.getRepository(Routine).count();
      expect(count).toBe(0);
    });

    it('positions duplicadas → 400 ROUTINE_ITEM_POSITION_DUPLICATED', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post('/routines')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          name: 'Dups',
          items: [
            {
              exerciseId: exerciseA1Id,
              position: 1,
              prescribedSets: 3,
              prescribedReps: '10',
            },
            {
              exerciseId: exerciseA2Id,
              position: 1,
              prescribedSets: 3,
              prescribedReps: '10',
            },
          ],
        })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe(
        'ROUTINE_ITEM_POSITION_DUPLICATED',
      );
    });

    it('DTO inválido (sin name) → 400', async () => {
      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .post('/routines')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          items: [
            {
              exerciseId: exerciseA1Id,
              position: 1,
              prescribedSets: 3,
              prescribedReps: '10',
            },
          ],
        })
        .expect(400);
    });

    it('Propiedad no-whitelisteada → 400', async () => {
      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .post('/routines')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          name: 'X',
          extra: 'no',
          items: [
            {
              exerciseId: exerciseA1Id,
              position: 1,
              prescribedSets: 3,
              prescribedReps: '10',
            },
          ],
        })
        .expect(400);
    });

    it('sin x-tenant-slug → 400 TENANT_SLUG_REQUIRED', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post('/routines')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'X',
          items: [
            {
              exerciseId: exerciseA1Id,
              position: 1,
              prescribedSets: 3,
              prescribedReps: '10',
            },
          ],
        })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('TENANT_SLUG_REQUIRED');
    });
  });

  // --------------------------------------------------------------------------
  // GET /routines
  // --------------------------------------------------------------------------
  describe('GET /routines', () => {
    it('STUDENT puede listar (sin items, con itemsCount)', async () => {
      const ownerLogin = await loginOwnerA();
      await createRoutineAs(ownerLogin.accessToken, TENANT_A_SLUG, {
        name: 'Tren superior',
        items: [
          {
            exerciseId: exerciseA1Id,
            position: 1,
            prescribedSets: 3,
            prescribedReps: '10',
          },
          {
            exerciseId: exerciseA2Id,
            position: 2,
            prescribedSets: 3,
            prescribedReps: '10',
          },
        ],
      });

      const studentLogin = await loginStudentA();
      const res = await request(app.getHttpServer())
        .get('/routines')
        .set('Authorization', `Bearer ${studentLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as PaginatedRoutinesBody;
      expect(body.total).toBe(1);
      expect(body.data[0]!.itemsCount).toBe(2);
      expect(body.data[0]!.name).toBe('Tren superior');
    });

    it('Filtro q="tren" matchea ILIKE en name', async () => {
      const { accessToken } = await loginOwnerA();
      await createRoutineAs(accessToken, TENANT_A_SLUG, {
        name: 'Tren superior',
        items: [
          {
            exerciseId: exerciseA1Id,
            position: 1,
            prescribedSets: 3,
            prescribedReps: '10',
          },
        ],
      });
      await createRoutineAs(accessToken, TENANT_A_SLUG, {
        name: 'Tren inferior',
        items: [
          {
            exerciseId: exerciseA2Id,
            position: 1,
            prescribedSets: 3,
            prescribedReps: '10',
          },
        ],
      });
      await createRoutineAs(accessToken, TENANT_A_SLUG, {
        name: 'Pull',
        items: [
          {
            exerciseId: exerciseA1Id,
            position: 1,
            prescribedSets: 3,
            prescribedReps: '10',
          },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/routines?q=tren')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as PaginatedRoutinesBody;
      expect(body.total).toBe(2);
    });

    it('Paginación page=1 pageSize=1', async () => {
      const { accessToken } = await loginOwnerA();
      await createRoutineAs(accessToken, TENANT_A_SLUG, {
        name: 'A',
        items: [
          {
            exerciseId: exerciseA1Id,
            position: 1,
            prescribedSets: 3,
            prescribedReps: '10',
          },
        ],
      });
      await createRoutineAs(accessToken, TENANT_A_SLUG, {
        name: 'B',
        items: [
          {
            exerciseId: exerciseA1Id,
            position: 1,
            prescribedSets: 3,
            prescribedReps: '10',
          },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/routines?page=1&pageSize=1')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as PaginatedRoutinesBody;
      expect(body.total).toBe(2);
      expect(body.data.length).toBe(1);
    });

    it('No ve routines de otro tenant', async () => {
      const { accessToken: tokenA } = await loginOwnerA();
      await createRoutineAs(tokenA, TENANT_A_SLUG, {
        name: 'Olimpo routine',
        items: [
          {
            exerciseId: exerciseA1Id,
            position: 1,
            prescribedSets: 3,
            prescribedReps: '10',
          },
        ],
      });
      const { accessToken: tokenB } = await loginOwnerB();
      await createRoutineAs(tokenB, TENANT_B_SLUG, {
        name: 'Spartan routine',
        items: [
          {
            exerciseId: exerciseB1Id,
            position: 1,
            prescribedSets: 3,
            prescribedReps: '10',
          },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/routines')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as PaginatedRoutinesBody;
      expect(body.total).toBe(1);
      expect(body.data[0]!.name).toBe('Olimpo routine');
    });
  });

  // --------------------------------------------------------------------------
  // GET /routines/:id
  // --------------------------------------------------------------------------
  describe('GET /routines/:id', () => {
    it('STUDENT lee detalle con items + exercises resueltos', async () => {
      const ownerLogin = await loginOwnerA();
      const created = await createRoutineAs(
        ownerLogin.accessToken,
        TENANT_A_SLUG,
        {
          name: 'Tren superior',
          items: [
            {
              exerciseId: exerciseA1Id,
              position: 1,
              prescribedSets: 3,
              prescribedReps: '10',
            },
          ],
        },
      );

      const studentLogin = await loginStudentA();
      const res = await request(app.getHttpServer())
        .get(`/routines/${created.id}`)
        .set('Authorization', `Bearer ${studentLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as RoutineResponseBody;
      expect(body.id).toBe(created.id);
      expect(body.items.length).toBe(1);
      expect(body.items[0]!.exercise.title).toBe('Press de banca');
    });

    it('id inexistente → 404 ROUTINE_NOT_FOUND', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .get('/routines/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('ROUTINE_NOT_FOUND');
    });

    it('Cross-tenant → 404 (no filtra existencia)', async () => {
      const ownerBLogin = await loginOwnerB();
      const created = await createRoutineAs(
        ownerBLogin.accessToken,
        TENANT_B_SLUG,
        {
          name: 'Spartan routine',
          items: [
            {
              exerciseId: exerciseB1Id,
              position: 1,
              prescribedSets: 3,
              prescribedReps: '10',
            },
          ],
        },
      );

      const ownerALogin = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .get(`/routines/${created.id}`)
        .set('Authorization', `Bearer ${ownerALogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('ROUTINE_NOT_FOUND');
    });
  });

  // --------------------------------------------------------------------------
  // PATCH /routines/:id
  // --------------------------------------------------------------------------
  describe('PATCH /routines/:id', () => {
    it('OWNER patcha name → 200, items intactos', async () => {
      const { accessToken } = await loginOwnerA();
      const created = await createRoutineAs(accessToken, TENANT_A_SLUG, {
        name: 'Original',
        items: [
          {
            exerciseId: exerciseA1Id,
            position: 1,
            prescribedSets: 3,
            prescribedReps: '10',
          },
        ],
      });
      const res = await request(app.getHttpServer())
        .patch(`/routines/${created.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ name: 'Nuevo' })
        .expect(200);
      const body = res.body as RoutineResponseBody;
      expect(body.name).toBe('Nuevo');
      expect(body.items.length).toBe(1);
    });

    it('PATCH con items → reemplaza el array completo (reorder/agregar/quitar)', async () => {
      const { accessToken } = await loginOwnerA();
      const created = await createRoutineAs(accessToken, TENANT_A_SLUG, {
        name: 'Original',
        items: [
          {
            exerciseId: exerciseA1Id,
            position: 1,
            prescribedSets: 3,
            prescribedReps: '10',
          },
        ],
      });
      const res = await request(app.getHttpServer())
        .patch(`/routines/${created.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          items: [
            {
              exerciseId: exerciseA2Id,
              position: 1,
              prescribedSets: 4,
              prescribedReps: '8',
            },
            {
              exerciseId: exerciseA1Id,
              position: 2,
              prescribedSets: 3,
              prescribedReps: '12',
            },
          ],
        })
        .expect(200);
      const body = res.body as RoutineResponseBody;
      expect(body.items.length).toBe(2);
      expect(body.items[0]!.exerciseId).toBe(exerciseA2Id);
      expect(body.items[1]!.exerciseId).toBe(exerciseA1Id);
      expect(body.items[0]!.prescribedSets).toBe(4);
      expect(body.items[1]!.prescribedReps).toBe('12');

      // Verificar en DB que solo hay 2 items (los viejos fueron borrados).
      const dbItems = await dataSource
        .getRepository(RoutineItem)
        .find({ where: { routineId: created.id } });
      expect(dbItems.length).toBe(2);
    });

    it('Reorder vía PATCH funciona (cambiar positions)', async () => {
      const { accessToken } = await loginOwnerA();
      const created = await createRoutineAs(accessToken, TENANT_A_SLUG, {
        name: 'R',
        items: [
          {
            exerciseId: exerciseA1Id,
            position: 1,
            prescribedSets: 3,
            prescribedReps: '10',
          },
          {
            exerciseId: exerciseA2Id,
            position: 2,
            prescribedSets: 3,
            prescribedReps: '10',
          },
        ],
      });
      const res = await request(app.getHttpServer())
        .patch(`/routines/${created.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          items: [
            {
              exerciseId: exerciseA2Id,
              position: 1,
              prescribedSets: 3,
              prescribedReps: '10',
            },
            {
              exerciseId: exerciseA1Id,
              position: 2,
              prescribedSets: 3,
              prescribedReps: '10',
            },
          ],
        })
        .expect(200);
      const body = res.body as RoutineResponseBody;
      expect(body.items[0]!.exerciseId).toBe(exerciseA2Id);
      expect(body.items[1]!.exerciseId).toBe(exerciseA1Id);
    });

    it('PATCH items con exerciseId de otro tenant → 400, rollback (items originales intactos)', async () => {
      const { accessToken } = await loginOwnerA();
      const created = await createRoutineAs(accessToken, TENANT_A_SLUG, {
        name: 'Original',
        items: [
          {
            exerciseId: exerciseA1Id,
            position: 1,
            prescribedSets: 3,
            prescribedReps: '10',
          },
        ],
      });
      const res = await request(app.getHttpServer())
        .patch(`/routines/${created.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          items: [
            {
              exerciseId: exerciseB1Id,
              position: 1,
              prescribedSets: 3,
              prescribedReps: '10',
            },
          ],
        })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe(
        'ROUTINE_ITEM_EXERCISE_NOT_FOUND',
      );

      // Item original sigue intacto en DB.
      const dbItems = await dataSource
        .getRepository(RoutineItem)
        .find({ where: { routineId: created.id } });
      expect(dbItems.length).toBe(1);
      expect(dbItems[0]!.exerciseId).toBe(exerciseA1Id);
    });

    it('description=null limpia el campo', async () => {
      const { accessToken } = await loginOwnerA();
      const created = await createRoutineAs(accessToken, TENANT_A_SLUG, {
        name: 'R',
        description: 'Algo',
        items: [
          {
            exerciseId: exerciseA1Id,
            position: 1,
            prescribedSets: 3,
            prescribedReps: '10',
          },
        ],
      });
      const res = await request(app.getHttpServer())
        .patch(`/routines/${created.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ description: null })
        .expect(200);
      expect((res.body as RoutineResponseBody).description).toBeNull();
    });

    it('STUDENT intenta patchar → 403 FORBIDDEN_ROLE', async () => {
      const ownerLogin = await loginOwnerA();
      const created = await createRoutineAs(
        ownerLogin.accessToken,
        TENANT_A_SLUG,
        {
          name: 'X',
          items: [
            {
              exerciseId: exerciseA1Id,
              position: 1,
              prescribedSets: 3,
              prescribedReps: '10',
            },
          ],
        },
      );

      const studentLogin = await loginStudentA();
      const res = await request(app.getHttpServer())
        .patch(`/routines/${created.id}`)
        .set('Authorization', `Bearer ${studentLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ name: 'Hack' })
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
    });

    it('inexistente → 404', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .patch('/routines/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ name: 'X' })
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('ROUTINE_NOT_FOUND');
    });

    it('Cross-tenant PATCH → 404 (no filtra existencia)', async () => {
      const ownerBLogin = await loginOwnerB();
      const created = await createRoutineAs(
        ownerBLogin.accessToken,
        TENANT_B_SLUG,
        {
          name: 'Spartan',
          items: [
            {
              exerciseId: exerciseB1Id,
              position: 1,
              prescribedSets: 3,
              prescribedReps: '10',
            },
          ],
        },
      );

      const ownerALogin = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .patch(`/routines/${created.id}`)
        .set('Authorization', `Bearer ${ownerALogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ name: 'Hack' })
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('ROUTINE_NOT_FOUND');
    });
  });

  // --------------------------------------------------------------------------
  // DELETE /routines/:id
  // --------------------------------------------------------------------------
  describe('DELETE /routines/:id', () => {
    it('OWNER borra → 204 (hard delete + cascade a routine_items)', async () => {
      const { accessToken } = await loginOwnerA();
      const created = await createRoutineAs(accessToken, TENANT_A_SLUG, {
        name: 'A borrar',
        items: [
          {
            exerciseId: exerciseA1Id,
            position: 1,
            prescribedSets: 3,
            prescribedReps: '10',
          },
        ],
      });

      await request(app.getHttpServer())
        .delete(`/routines/${created.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(204);

      const r = await dataSource
        .getRepository(Routine)
        .findOne({ where: { id: created.id } });
      expect(r).toBeNull();
      const items = await dataSource
        .getRepository(RoutineItem)
        .find({ where: { routineId: created.id } });
      expect(items.length).toBe(0);
    });

    it('STUDENT intenta borrar → 403 FORBIDDEN_ROLE', async () => {
      const ownerLogin = await loginOwnerA();
      const created = await createRoutineAs(
        ownerLogin.accessToken,
        TENANT_A_SLUG,
        {
          name: 'X',
          items: [
            {
              exerciseId: exerciseA1Id,
              position: 1,
              prescribedSets: 3,
              prescribedReps: '10',
            },
          ],
        },
      );

      const studentLogin = await loginStudentA();
      const res = await request(app.getHttpServer())
        .delete(`/routines/${created.id}`)
        .set('Authorization', `Bearer ${studentLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
    });

    it('Cross-tenant DELETE → 404, no afecta al routine de B', async () => {
      const ownerBLogin = await loginOwnerB();
      const created = await createRoutineAs(
        ownerBLogin.accessToken,
        TENANT_B_SLUG,
        {
          name: 'Spartan',
          items: [
            {
              exerciseId: exerciseB1Id,
              position: 1,
              prescribedSets: 3,
              prescribedReps: '10',
            },
          ],
        },
      );

      const ownerALogin = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .delete(`/routines/${created.id}`)
        .set('Authorization', `Bearer ${ownerALogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('ROUTINE_NOT_FOUND');

      const r = await dataSource
        .getRepository(Routine)
        .findOne({ where: { id: created.id } });
      expect(r).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------
  describe('auth requerido', () => {
    it('GET sin bearer → 401', async () => {
      await request(app.getHttpServer())
        .get('/routines')
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(401);
    });

    it('POST sin bearer → 401', async () => {
      await request(app.getHttpServer())
        .post('/routines')
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          name: 'X',
          items: [
            {
              exerciseId: exerciseA1Id,
              position: 1,
              prescribedSets: 3,
              prescribedReps: '10',
            },
          ],
        })
        .expect(401);
    });
  });
});
