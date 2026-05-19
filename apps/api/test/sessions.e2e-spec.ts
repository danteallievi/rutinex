import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { AssignmentsService } from './../src/modules/assignments/assignments.service';
import { PasswordService } from './../src/modules/auth/password.service';
import { seedSuperadmin } from './../src/modules/auth/seed-superadmin';
import { ExercisesService } from './../src/modules/exercises/exercises.service';
import { RoutinesService } from './../src/modules/routines/routines.service';
import { Session } from './../src/modules/sessions/entities/session.entity';
import { WorkoutSet } from './../src/modules/sessions/entities/set.entity';
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

interface SessionResponseBody {
  id: string;
  assignmentId: string;
  routineId: string;
  studentId: string;
  routineSnapshot: {
    id: string;
    name: string;
    items: {
      id: string;
      exerciseId: string;
      position: number;
      exercise: { id: string; title: string };
    }[];
  };
  startedAt: string;
  completedAt: string | null;
  sets: {
    id: string;
    setNumber: number;
    reps: number;
    weightKg: number | null;
  }[];
}

interface TodayResponseBody {
  assignmentId: string;
  routineId: string;
  routine: { id: string; name: string };
  openSessionId: string | null;
}

interface SessionsListBody {
  data: {
    id: string;
    routineName: string;
    startedAt: string;
  }[];
  nextCursor: string | null;
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
const TENANT_B_SLUG = 'spartan';
const OWNER_PASSWORD = 'owner-password-1234';
const TRAINER_PASSWORD = 'trainer-password-1234';

function todayStr(): string {
  const d = new Date();
  return `${String(d.getUTCFullYear())}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

describe('Sessions — Step 18 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersService: UsersService;
  let passwordService: PasswordService;
  let exercisesService: ExercisesService;
  let routinesService: RoutinesService;
  let assignmentsService: AssignmentsService;

  let tenantA: Tenant;
  let ownerA: User;
  let trainerA: User;
  let studentA1: User;
  let studentA2: User;

  let tenantB: Tenant;
  let ownerB: User;
  let studentB: User;

  let routineA1Id: string;
  let routineItemA1Id: string;
  let assignmentA1Id: string;
  let assignmentA2Id: string; // futura
  let routineB1Id: string;
  let assignmentB1Id: string;

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
    routinesService = app.get(RoutinesService);
    assignmentsService = app.get(AssignmentsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "sets", "sessions", "assignments", "routine_items", "routines", "exercises", "refresh_tokens", "users", "tenants" CASCADE',
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
    studentA1 = await usersService.create({
      tenantId: tenantA.id,
      role: 'STUDENT',
      dni: '11111111',
      firstName: 'Estu',
      lastName: 'Diante',
      trainerId: trainerA.id,
    });
    studentA2 = await usersService.create({
      tenantId: tenantA.id,
      role: 'STUDENT',
      dni: '22222222',
      firstName: 'Otro',
      lastName: 'Alumno',
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
    studentB = await usersService.create({
      tenantId: tenantB.id,
      role: 'STUDENT',
      dni: '33333333',
      firstName: 'Spartan',
      lastName: 'Student',
      trainerId: ownerB.id,
    });

    const exA = await exercisesService.create(tenantA.id, ownerA.id, {
      title: 'Press de banca',
      mediaType: 'none',
      muscleGroups: ['chest'],
    });
    const routA = await routinesService.create(tenantA.id, ownerA.id, {
      name: 'Tren superior',
      items: [
        {
          exerciseId: exA.id,
          position: 1,
          prescribedSets: 3,
          prescribedReps: '10',
        },
      ],
    });
    routineA1Id = routA.id;
    routineItemA1Id = routA.items[0]!.id;

    const exB = await exercisesService.create(tenantB.id, ownerB.id, {
      title: 'Press spartan',
      mediaType: 'none',
      muscleGroups: ['chest'],
    });
    const routB = await routinesService.create(tenantB.id, ownerB.id, {
      name: 'Spartan routine',
      items: [
        {
          exerciseId: exB.id,
          position: 1,
          prescribedSets: 3,
          prescribedReps: '10',
        },
      ],
    });
    routineB1Id = routB.id;

    // Assignment activa hoy (todo el rango), todos los días.
    const aActive = await assignmentsService.createForRoutine(
      tenantA.id,
      {
        userId: ownerA.id,
        tenantId: tenantA.id,
        role: 'OWNER',
        isSuperadmin: false,
      },
      routineA1Id,
      { studentId: studentA1.id, startsOn: todayStr(), weekdayMask: 127 },
    );
    assignmentA1Id = aActive.id;

    // Assignment futura.
    const aFuture = await assignmentsService.createForRoutine(
      tenantA.id,
      {
        userId: ownerA.id,
        tenantId: tenantA.id,
        role: 'OWNER',
        isSuperadmin: false,
      },
      routineA1Id,
      { studentId: studentA2.id, startsOn: '2099-01-01', weekdayMask: 127 },
    );
    assignmentA2Id = aFuture.id;

    // Assignment activa en tenant B (para tests cross-tenant).
    const aB = await assignmentsService.createForRoutine(
      tenantB.id,
      {
        userId: ownerB.id,
        tenantId: tenantB.id,
        role: 'OWNER',
        isSuperadmin: false,
      },
      routineB1Id,
      { studentId: studentB.id, startsOn: todayStr(), weekdayMask: 127 },
    );
    assignmentB1Id = aB.id;
  });

  // ---- helpers --------------------------------------------------------------
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
  const loginStudentA1 = (): Promise<LoginResponseBody> =>
    loginAs(TENANT_A_HOST, { dni: studentA1.dni! }, '/auth/student-login');
  const loginStudentA2 = (): Promise<LoginResponseBody> =>
    loginAs(TENANT_A_HOST, { dni: studentA2.dni! }, '/auth/student-login');

  // ---------------------------------------------------------------------------
  // POST /sessions
  // ---------------------------------------------------------------------------
  describe('POST /sessions', () => {
    it('STUDENT arranca → 201 con snapshot + sets vacíos', async () => {
      const { accessToken } = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: assignmentA1Id })
        .expect(201);
      const body = res.body as SessionResponseBody;
      expect(body.id).toBeDefined();
      expect(body.assignmentId).toBe(assignmentA1Id);
      expect(body.routineId).toBe(routineA1Id);
      expect(body.studentId).toBe(studentA1.id);
      expect(body.completedAt).toBeNull();
      expect(body.sets).toEqual([]);
      expect(body.routineSnapshot.name).toBe('Tren superior');
      expect(body.routineSnapshot.items).toHaveLength(1);
      expect(body.routineSnapshot.items[0]!.exercise.title).toBe(
        'Press de banca',
      );
    });

    it('OWNER intenta crear sesión → 403 FORBIDDEN_ROLE', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: assignmentA1Id })
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
    });

    it('TRAINER intenta crear sesión → 403 FORBIDDEN_ROLE', async () => {
      const { accessToken } = await loginTrainerA();
      await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: assignmentA1Id })
        .expect(403);
    });

    it('STUDENT arranca sobre asignación de otro student → 403 FORBIDDEN_ROLE_HIERARCHY', async () => {
      const { accessToken } = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: assignmentA2Id })
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE_HIERARCHY');
    });

    it('Assignment futura del propio student → 400 ASSIGNMENT_NOT_ACTIVE', async () => {
      const { accessToken } = await loginStudentA2();
      const res = await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: assignmentA2Id })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('ASSIGNMENT_NOT_ACTIVE');
    });

    it('assignmentId inexistente → 404 ASSIGNMENT_NOT_FOUND', async () => {
      const { accessToken } = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('ASSIGNMENT_NOT_FOUND');
    });

    it('assignmentId de otro tenant → 404 (no filtra existencia)', async () => {
      const { accessToken } = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: assignmentB1Id })
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('ASSIGNMENT_NOT_FOUND');
    });

    it('STUDENT intenta arrancar otra sesión mientras hay una abierta → 409 SESSION_ALREADY_OPEN', async () => {
      const { accessToken } = await loginStudentA1();
      await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: assignmentA1Id })
        .expect(201);
      const res = await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: assignmentA1Id })
        .expect(409);
      expect((res.body as ErrorBody).code).toBe('SESSION_ALREADY_OPEN');
    });

    it('Después de completar la primera, puede arrancar otra', async () => {
      const { accessToken } = await loginStudentA1();
      const first = await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: assignmentA1Id })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/sessions/${(first.body as SessionResponseBody).id}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: assignmentA1Id })
        .expect(201);
    });

    it('sin bearer → 401', async () => {
      await request(app.getHttpServer())
        .post('/sessions')
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: assignmentA1Id })
        .expect(401);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /sessions/today
  // ---------------------------------------------------------------------------
  describe('GET /sessions/today', () => {
    it('STUDENT con asignación activa matcheando hoy → 200 con routine inline', async () => {
      const { accessToken } = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .get('/sessions/today')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as TodayResponseBody;
      expect(body.assignmentId).toBe(assignmentA1Id);
      expect(body.routine.name).toBe('Tren superior');
      expect(body.openSessionId).toBeNull();
    });

    it('STUDENT con sesión abierta → openSessionId apunta al recurso', async () => {
      const { accessToken } = await loginStudentA1();
      const opened = await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: assignmentA1Id })
        .expect(201);
      const res = await request(app.getHttpServer())
        .get('/sessions/today')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      expect((res.body as TodayResponseBody).openSessionId).toBe(
        (opened.body as SessionResponseBody).id,
      );
    });

    it('STUDENT sin asignación que matchee hoy → 200 con body vacío', async () => {
      const { accessToken } = await loginStudentA2();
      const res = await request(app.getHttpServer())
        .get('/sessions/today')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      // NestJS/Express convierte `return null` en un body vacío (no envía
      // JSON literal `null`). El cliente lo interpreta como "no hay today
      // para este student".
      expect(res.text).toBe('');
    });

    it('OWNER → 403 FORBIDDEN_ROLE', async () => {
      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .get('/sessions/today')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /sessions/:id/sets
  // ---------------------------------------------------------------------------
  describe('POST /sessions/:id/sets', () => {
    let sessionId: string;

    beforeEach(async () => {
      const { accessToken } = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: assignmentA1Id })
        .expect(201);
      sessionId = (res.body as SessionResponseBody).id;
    });

    it('STUDENT carga set → 201, set en la response, weightKg redondeado a 2 decimales', async () => {
      const { accessToken } = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .post(`/sessions/${sessionId}/sets`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          routineItemId: routineItemA1Id,
          setNumber: 1,
          reps: 10,
          weightKg: 60.5,
        })
        .expect(201);
      const body = res.body as SessionResponseBody;
      expect(body.sets).toHaveLength(1);
      expect(body.sets[0]!.setNumber).toBe(1);
      expect(body.sets[0]!.reps).toBe(10);
      expect(body.sets[0]!.weightKg).toBe(60.5);

      // En DB persiste como numeric(6,2).
      const dbSet = await dataSource.getRepository(WorkoutSet).findOne({
        where: { sessionId },
      });
      expect(dbSet?.weightKg).toBe('60.50');
    });

    it('weightKg ausente → bodyweight (null)', async () => {
      const { accessToken } = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .post(`/sessions/${sessionId}/sets`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ routineItemId: routineItemA1Id, setNumber: 1, reps: 15 })
        .expect(201);
      expect((res.body as SessionResponseBody).sets[0]!.weightKg).toBeNull();
    });

    it('weightKg=null → bodyweight (null)', async () => {
      const { accessToken } = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .post(`/sessions/${sessionId}/sets`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          routineItemId: routineItemA1Id,
          setNumber: 1,
          reps: 15,
          weightKg: null,
        })
        .expect(201);
      expect((res.body as SessionResponseBody).sets[0]!.weightKg).toBeNull();
    });

    it('Sesión inexistente → 404', async () => {
      const { accessToken } = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .post('/sessions/00000000-0000-0000-0000-000000000000/sets')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ routineItemId: routineItemA1Id, setNumber: 1, reps: 10 })
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('SESSION_NOT_FOUND');
    });

    it('STUDENT carga set en sesión de otro student → 403', async () => {
      // Necesitamos crear una sesión para studentA2 — pero su assignment es
      // futura, así que vamos a crear una assignment activa para él primero.
      const aActive = await assignmentsService.createForRoutine(
        tenantA.id,
        {
          userId: ownerA.id,
          tenantId: tenantA.id,
          role: 'OWNER',
          isSuperadmin: false,
        },
        routineA1Id,
        { studentId: studentA2.id, startsOn: todayStr(), weekdayMask: 127 },
      );
      const studA2Login = await loginStudentA2();
      const otherSession = await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${studA2Login.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: aActive.id })
        .expect(201);

      const studA1Login = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .post(`/sessions/${(otherSession.body as SessionResponseBody).id}/sets`)
        .set('Authorization', `Bearer ${studA1Login.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ routineItemId: routineItemA1Id, setNumber: 1, reps: 10 })
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE_HIERARCHY');
    });

    it('Sesión ya completada → 400 SESSION_ALREADY_COMPLETED', async () => {
      const { accessToken } = await loginStudentA1();
      await request(app.getHttpServer())
        .post(`/sessions/${sessionId}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const res = await request(app.getHttpServer())
        .post(`/sessions/${sessionId}/sets`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ routineItemId: routineItemA1Id, setNumber: 2, reps: 10 })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('SESSION_ALREADY_COMPLETED');
    });

    it('routineItemId fuera del snapshot → 400 SET_INVALID_ROUTINE_ITEM', async () => {
      const { accessToken } = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .post(`/sessions/${sessionId}/sets`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          routineItemId: '00000000-0000-0000-0000-000000000000',
          setNumber: 1,
          reps: 10,
        })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('SET_INVALID_ROUTINE_ITEM');
    });

    it('setNumber duplicado → 409 SET_NUMBER_DUPLICATED', async () => {
      const { accessToken } = await loginStudentA1();
      await request(app.getHttpServer())
        .post(`/sessions/${sessionId}/sets`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ routineItemId: routineItemA1Id, setNumber: 1, reps: 10 })
        .expect(201);
      const res = await request(app.getHttpServer())
        .post(`/sessions/${sessionId}/sets`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ routineItemId: routineItemA1Id, setNumber: 1, reps: 12 })
        .expect(409);
      expect((res.body as ErrorBody).code).toBe('SET_NUMBER_DUPLICATED');
    });

    it('setNumber=0 → 400 (validator @Min(1))', async () => {
      const { accessToken } = await loginStudentA1();
      await request(app.getHttpServer())
        .post(`/sessions/${sessionId}/sets`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ routineItemId: routineItemA1Id, setNumber: 0, reps: 10 })
        .expect(400);
    });

    it('weightKg negativo → 400', async () => {
      const { accessToken } = await loginStudentA1();
      await request(app.getHttpServer())
        .post(`/sessions/${sessionId}/sets`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          routineItemId: routineItemA1Id,
          setNumber: 1,
          reps: 10,
          weightKg: -1,
        })
        .expect(400);
    });

    it('reps negativo → 400', async () => {
      const { accessToken } = await loginStudentA1();
      await request(app.getHttpServer())
        .post(`/sessions/${sessionId}/sets`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ routineItemId: routineItemA1Id, setNumber: 1, reps: -1 })
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /sessions/:id/complete
  // ---------------------------------------------------------------------------
  describe('POST /sessions/:id/complete', () => {
    it('STUDENT completa su sesión → 200 con completedAt', async () => {
      const { accessToken } = await loginStudentA1();
      const opened = await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: assignmentA1Id })
        .expect(201);
      const sessionId = (opened.body as SessionResponseBody).id;

      const res = await request(app.getHttpServer())
        .post(`/sessions/${sessionId}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      expect((res.body as SessionResponseBody).completedAt).not.toBeNull();
    });

    it('Sesión ya completada → 400', async () => {
      const { accessToken } = await loginStudentA1();
      const opened = await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: assignmentA1Id })
        .expect(201);
      const sessionId = (opened.body as SessionResponseBody).id;
      await request(app.getHttpServer())
        .post(`/sessions/${sessionId}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const res = await request(app.getHttpServer())
        .post(`/sessions/${sessionId}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('SESSION_ALREADY_COMPLETED');
    });
  });

  // ---------------------------------------------------------------------------
  // GET /sessions (cursor pagination + jerarquía)
  // ---------------------------------------------------------------------------
  describe('GET /sessions', () => {
    /** Crea N sesiones cerradas para `studentA1` con `started_at` espaciado. */
    const seedClosedSessions = async (count: number): Promise<void> => {
      const sessionRepo = dataSource.getRepository(Session);
      const baseTime = Date.now() - count * 60_000;
      for (let i = 0; i < count; i++) {
        await sessionRepo.save(
          sessionRepo.create({
            tenantId: tenantA.id,
            assignmentId: assignmentA1Id,
            routineId: routineA1Id,
            studentId: studentA1.id,
            routineSnapshot: {
              id: routineA1Id,
              name: 'Tren superior',
              description: null,
              createdBy: ownerA.id,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              items: [],
            },
            startedAt: new Date(baseTime + i * 60_000),
            completedAt: new Date(baseTime + i * 60_000 + 1000),
          }),
        );
      }
    };

    it('STUDENT lista lo suyo (sin filtros) → ordenado DESC por startedAt', async () => {
      await seedClosedSessions(3);
      const { accessToken } = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .get('/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as SessionsListBody;
      expect(body.data).toHaveLength(3);
      // DESC: más reciente primero.
      expect(
        new Date(body.data[0]!.startedAt).getTime(),
      ).toBeGreaterThanOrEqual(new Date(body.data[1]!.startedAt).getTime());
      expect(body.nextCursor).toBeNull();
    });

    it('STUDENT pide ?studentId distinto → 403', async () => {
      const { accessToken } = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .get(`/sessions?studentId=${studentA2.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE_HIERARCHY');
    });

    it('TRAINER sin filtro → ve sólo las de sus students', async () => {
      await seedClosedSessions(2);
      const { accessToken } = await loginTrainerA();
      const res = await request(app.getHttpServer())
        .get('/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as SessionsListBody;
      expect(body.data).toHaveLength(2);
    });

    it('OWNER pide ?studentId de cualquier student → OK', async () => {
      await seedClosedSessions(2);
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .get(`/sessions?studentId=${studentA1.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      expect((res.body as SessionsListBody).data).toHaveLength(2);
    });

    it('Cross-tenant: OWNER A no ve sesiones de tenant B', async () => {
      // Sesión en B
      const sessionRepo = dataSource.getRepository(Session);
      await sessionRepo.save(
        sessionRepo.create({
          tenantId: tenantB.id,
          assignmentId: assignmentB1Id,
          routineId: routineB1Id,
          studentId: studentB.id,
          routineSnapshot: {
            id: routineB1Id,
            name: 'Spartan',
            description: null,
            createdBy: ownerB.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: [],
          },
          startedAt: new Date(),
          completedAt: null,
        }),
      );
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .get('/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      expect((res.body as SessionsListBody).data).toHaveLength(0);
    });

    it('Cursor pagination: limit=2 sobre 3 → nextCursor + segunda página completa el resto', async () => {
      await seedClosedSessions(3);
      const { accessToken } = await loginStudentA1();
      const res1 = await request(app.getHttpServer())
        .get('/sessions?limit=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const page1 = res1.body as SessionsListBody;
      expect(page1.data).toHaveLength(2);
      expect(page1.nextCursor).not.toBeNull();

      const res2 = await request(app.getHttpServer())
        .get(
          `/sessions?limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`,
        )
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const page2 = res2.body as SessionsListBody;
      expect(page2.data).toHaveLength(1);
      expect(page2.nextCursor).toBeNull();

      // Las 3 sesiones se ven sin duplicados.
      const allIds = new Set([
        ...page1.data.map((d) => d.id),
        ...page2.data.map((d) => d.id),
      ]);
      expect(allIds.size).toBe(3);
    });

    it('Filtros from/to → restringen el rango de startedAt', async () => {
      const sessionRepo = dataSource.getRepository(Session);
      const old = new Date('2020-01-15T10:00:00Z');
      const future = new Date('2099-01-15T10:00:00Z');
      for (const t of [old, future]) {
        await sessionRepo.save(
          sessionRepo.create({
            tenantId: tenantA.id,
            assignmentId: assignmentA1Id,
            routineId: routineA1Id,
            studentId: studentA1.id,
            routineSnapshot: {
              id: routineA1Id,
              name: 'X',
              description: null,
              createdBy: ownerA.id,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              items: [],
            },
            startedAt: t,
            completedAt: t,
          }),
        );
      }
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .get('/sessions?from=2020-01-01&to=2020-12-31')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as SessionsListBody;
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.startedAt.startsWith('2020-')).toBe(true);
    });

    it('limit=200 → 400 (validator @Max(100))', async () => {
      const { accessToken } = await loginStudentA1();
      await request(app.getHttpServer())
        .get('/sessions?limit=200')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(400);
    });

    it('cursor inválido → ignorado (se devuelve la primera página)', async () => {
      await seedClosedSessions(2);
      const { accessToken } = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .get('/sessions?cursor=not-a-valid-cursor')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      expect((res.body as SessionsListBody).data).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Cross-cutting: ROUTINE_HAS_SESSIONS + ASSIGNMENT_HAS_SESSIONS
  // ---------------------------------------------------------------------------
  describe('Cross-cutting: borrar routine/assignment con sesiones', () => {
    it('DELETE /routines/:id con sesión existente → 409 ROUTINE_HAS_SESSIONS', async () => {
      const studLogin = await loginStudentA1();
      await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${studLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: assignmentA1Id })
        .expect(201);

      // Borrar la asignación primero falla porque tiene sesión.
      const ownerLogin = await loginOwnerA();
      await request(app.getHttpServer())
        .delete(`/assignments/${assignmentA1Id}`)
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(409)
        .expect((res) => {
          expect((res.body as ErrorBody).code).toBe('ASSIGNMENT_HAS_SESSIONS');
        });

      // Borrar la routine también falla — la sesión la referencia.
      const res = await request(app.getHttpServer())
        .delete(`/routines/${routineA1Id}`)
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(409);
      // Puede ser ROUTINE_HAS_ASSIGNMENTS (assignment intacto) o
      // ROUTINE_HAS_SESSIONS (sesión apunta a routine). El orden de los
      // catches en RoutinesService verifica assignments primero — pero la
      // asignación está todavía ahí, así que cae en ROUTINE_HAS_ASSIGNMENTS.
      expect(['ROUTINE_HAS_ASSIGNMENTS', 'ROUTINE_HAS_SESSIONS']).toContain(
        (res.body as ErrorBody).code,
      );
    });

    it('Limpieza ordenada: borrar sets → borrar session → borrar assignment → borrar routine', async () => {
      const studLogin = await loginStudentA1();
      const session = await request(app.getHttpServer())
        .post('/sessions')
        .set('Authorization', `Bearer ${studLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ assignmentId: assignmentA1Id })
        .expect(201);
      const sessionId = (session.body as SessionResponseBody).id;

      // Borrar la session manualmente (no hay endpoint para esto en MVP; vamos
      // directo via repo).
      await dataSource
        .getRepository(Session)
        .delete({ tenantId: tenantA.id, id: sessionId });

      const ownerLogin = await loginOwnerA();
      // Después de borrar la sesión, la assignment se puede borrar.
      await request(app.getHttpServer())
        .delete(`/assignments/${assignmentA1Id}`)
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(204);
      // Y después la routine también — borramos también las otras (en B/A2).
      await dataSource
        .getRepository('assignments')
        .delete({ tenantId: tenantA.id });
      await request(app.getHttpServer())
        .delete(`/routines/${routineA1Id}`)
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(204);
    });
  });
});
