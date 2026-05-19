import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { PasswordService } from './../src/modules/auth/password.service';
import { seedSuperadmin } from './../src/modules/auth/seed-superadmin';
import { Assignment } from './../src/modules/assignments/entities/assignment.entity';
import { ExercisesService } from './../src/modules/exercises/exercises.service';
import { RoutinesService } from './../src/modules/routines/routines.service';
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

interface AssignmentResponseBody {
  id: string;
  routineId: string;
  studentId: string;
  assignedBy: string;
  startsOn: string;
  endsOn: string | null;
  weekdayMask: number;
  status: 'active' | 'expired' | 'future';
  createdAt: string;
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

describe('Assignments — Step 17 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersService: UsersService;
  let passwordService: PasswordService;
  let exercisesService: ExercisesService;
  let routinesService: RoutinesService;

  let tenantA: Tenant;
  let ownerA: User;
  let trainerA: User;
  let trainerA2: User;
  let studentA1: User;
  let studentA2: User;

  let tenantB: Tenant;
  let ownerB: User;
  let studentB: User;

  let routineA1Id: string;
  let routineB1Id: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "assignments", "routine_items", "routines", "exercises", "refresh_tokens", "users", "tenants" CASCADE',
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
    trainerA2 = await usersService.create({
      tenantId: tenantA.id,
      role: 'TRAINER',
      email: 'trainer2@olimpo.test',
      passwordHash: await passwordService.hash(TRAINER_PASSWORD),
      firstName: 'Tina',
      lastName: 'Otra',
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
      trainerId: trainerA2.id, // alumno de otro trainer
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
      trainerId: ownerB.id, // workaround: tenant B no tiene TRAINER en este fixture
    });

    // Seed exercises + routines
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
  });

  // ----- helpers ------------------------------------------------------------

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
  const loginTrainerA2 = (): Promise<LoginResponseBody> =>
    loginAs(TENANT_A_HOST, {
      email: trainerA2.email!,
      password: TRAINER_PASSWORD,
    });
  const loginStudentA1 = (): Promise<LoginResponseBody> =>
    loginAs(TENANT_A_HOST, { dni: studentA1.dni! }, '/auth/student-login');
  const loginOwnerB = (): Promise<LoginResponseBody> =>
    loginAs(TENANT_B_HOST, { email: ownerB.email!, password: OWNER_PASSWORD });

  const assignAs = async (
    accessToken: string,
    slug: string,
    routineId: string,
    body: Record<string, unknown>,
  ): Promise<AssignmentResponseBody> => {
    const res = await request(app.getHttpServer())
      .post(`/routines/${routineId}/assignments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-slug', slug)
      .send(body)
      .expect(201);
    return res.body as AssignmentResponseBody;
  };

  // --------------------------------------------------------------------------
  // POST /routines/:id/assignments
  // --------------------------------------------------------------------------
  describe('POST /routines/:id/assignments', () => {
    it('OWNER asigna a STUDENT del tenant → 201 + assignedBy = owner', async () => {
      const { accessToken } = await loginOwnerA();
      const body = await assignAs(accessToken, TENANT_A_SLUG, routineA1Id, {
        studentId: studentA1.id,
        startsOn: '2026-05-18',
        endsOn: '2026-08-18',
        weekdayMask: 0b0101010,
      });
      expect(body.routineId).toBe(routineA1Id);
      expect(body.studentId).toBe(studentA1.id);
      expect(body.assignedBy).toBe(ownerA.id);
      expect(body.weekdayMask).toBe(0b0101010);
      expect(body.endsOn).toBe('2026-08-18');
      expect(body.id).toBeDefined();
    });

    it('TRAINER asigna a su propio STUDENT → 201', async () => {
      const { accessToken } = await loginTrainerA();
      const body = await assignAs(accessToken, TENANT_A_SLUG, routineA1Id, {
        studentId: studentA1.id,
        startsOn: '2026-05-18',
        weekdayMask: 0b0000010, // sólo lunes
      });
      expect(body.assignedBy).toBe(trainerA.id);
      expect(body.endsOn).toBeNull();
    });

    it('TRAINER asigna a STUDENT de otro trainer → 403 FORBIDDEN_ROLE_HIERARCHY', async () => {
      const { accessToken } = await loginTrainerA();
      const res = await request(app.getHttpServer())
        .post(`/routines/${routineA1Id}/assignments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          studentId: studentA2.id, // de trainerA2
          startsOn: '2026-05-18',
          weekdayMask: 1,
        })
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE_HIERARCHY');

      // En DB no quedó nada.
      const count = await dataSource.getRepository(Assignment).count();
      expect(count).toBe(0);
    });

    it('STUDENT intenta asignar → 403 FORBIDDEN_ROLE', async () => {
      const { accessToken } = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .post(`/routines/${routineA1Id}/assignments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          studentId: studentA1.id,
          startsOn: '2026-05-18',
          weekdayMask: 1,
        })
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
    });

    it('routineId inexistente → 404 ROUTINE_NOT_FOUND', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post('/routines/00000000-0000-0000-0000-000000000000/assignments')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          studentId: studentA1.id,
          startsOn: '2026-05-18',
          weekdayMask: 1,
        })
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('ROUTINE_NOT_FOUND');
    });

    it('routineId de otro tenant → 404 (no filtra existencia)', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post(`/routines/${routineB1Id}/assignments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          studentId: studentA1.id,
          startsOn: '2026-05-18',
          weekdayMask: 1,
        })
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('ROUTINE_NOT_FOUND');
    });

    it('studentId de otro tenant → 404 STUDENT_NOT_FOUND', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post(`/routines/${routineA1Id}/assignments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          studentId: studentB.id,
          startsOn: '2026-05-18',
          weekdayMask: 1,
        })
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('STUDENT_NOT_FOUND');
    });

    it('studentId apunta a un TRAINER → 400 ASSIGNMENT_INVALID_STUDENT', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post(`/routines/${routineA1Id}/assignments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          studentId: trainerA.id,
          startsOn: '2026-05-18',
          weekdayMask: 1,
        })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('ASSIGNMENT_INVALID_STUDENT');
    });

    it('endsOn < startsOn → 400 ASSIGNMENT_INVALID_DATE_RANGE', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post(`/routines/${routineA1Id}/assignments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          studentId: studentA1.id,
          startsOn: '2026-05-18',
          endsOn: '2026-05-10',
          weekdayMask: 1,
        })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe(
        'ASSIGNMENT_INVALID_DATE_RANGE',
      );
    });

    it('weekdayMask = 0 → 400 (validator @Min(1))', async () => {
      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .post(`/routines/${routineA1Id}/assignments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          studentId: studentA1.id,
          startsOn: '2026-05-18',
          weekdayMask: 0,
        })
        .expect(400);
    });

    it('weekdayMask = 128 → 400 (validator @Max(127))', async () => {
      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .post(`/routines/${routineA1Id}/assignments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          studentId: studentA1.id,
          startsOn: '2026-05-18',
          weekdayMask: 128,
        })
        .expect(400);
    });

    it('startsOn formato inválido → 400 (no es ISO)', async () => {
      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .post(`/routines/${routineA1Id}/assignments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          studentId: studentA1.id,
          startsOn: '18/05/2026',
          weekdayMask: 1,
        })
        .expect(400);
    });

    it('Propiedad no-whitelisteada → 400', async () => {
      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .post(`/routines/${routineA1Id}/assignments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          studentId: studentA1.id,
          startsOn: '2026-05-18',
          weekdayMask: 1,
          extra: 'no',
        })
        .expect(400);
    });

    it('sin bearer → 401', async () => {
      await request(app.getHttpServer())
        .post(`/routines/${routineA1Id}/assignments`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          studentId: studentA1.id,
          startsOn: '2026-05-18',
          weekdayMask: 1,
        })
        .expect(401);
    });
  });

  // --------------------------------------------------------------------------
  // GET /students/:id/assignments
  // --------------------------------------------------------------------------
  describe('GET /students/:id/assignments', () => {
    it('OWNER lista assignments de cualquier STUDENT', async () => {
      const ownerLogin = await loginOwnerA();
      await assignAs(ownerLogin.accessToken, TENANT_A_SLUG, routineA1Id, {
        studentId: studentA1.id,
        startsOn: '2026-05-18',
        weekdayMask: 1,
      });

      const res = await request(app.getHttpServer())
        .get(`/students/${studentA1.id}/assignments`)
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as AssignmentResponseBody[];
      expect(body.length).toBe(1);
      expect(body[0]!.studentId).toBe(studentA1.id);
    });

    it('TRAINER lista assignments de su propio STUDENT', async () => {
      const ownerLogin = await loginOwnerA();
      await assignAs(ownerLogin.accessToken, TENANT_A_SLUG, routineA1Id, {
        studentId: studentA1.id,
        startsOn: '2026-05-18',
        weekdayMask: 1,
      });

      const trainerLogin = await loginTrainerA();
      const res = await request(app.getHttpServer())
        .get(`/students/${studentA1.id}/assignments`)
        .set('Authorization', `Bearer ${trainerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      expect((res.body as AssignmentResponseBody[]).length).toBe(1);
    });

    it('TRAINER lee assignments de STUDENT de otro trainer → 403', async () => {
      const trainerLogin = await loginTrainerA();
      const res = await request(app.getHttpServer())
        .get(`/students/${studentA2.id}/assignments`)
        .set('Authorization', `Bearer ${trainerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE_HIERARCHY');
    });

    it('STUDENT lee lo suyo → OK', async () => {
      const ownerLogin = await loginOwnerA();
      await assignAs(ownerLogin.accessToken, TENANT_A_SLUG, routineA1Id, {
        studentId: studentA1.id,
        startsOn: '2026-05-18',
        weekdayMask: 1,
      });

      const studentLogin = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .get(`/students/${studentA1.id}/assignments`)
        .set('Authorization', `Bearer ${studentLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      expect((res.body as AssignmentResponseBody[]).length).toBe(1);
    });

    it('STUDENT lee de otro STUDENT → 403', async () => {
      const studentLogin = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .get(`/students/${studentA2.id}/assignments`)
        .set('Authorization', `Bearer ${studentLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE_HIERARCHY');
    });

    it('id apunta a un TRAINER (no STUDENT) → 404 STUDENT_NOT_FOUND', async () => {
      const ownerLogin = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .get(`/students/${trainerA.id}/assignments`)
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('STUDENT_NOT_FOUND');
    });

    it('Cross-tenant (STUDENT de B) → 404 STUDENT_NOT_FOUND', async () => {
      const ownerLogin = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .get(`/students/${studentB.id}/assignments`)
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('STUDENT_NOT_FOUND');
    });

    it('filter status=active → sólo activas', async () => {
      const ownerLogin = await loginOwnerA();
      // hoy = real
      const now = new Date();
      const yyyy = now.getUTCFullYear();
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(now.getUTCDate()).padStart(2, '0');
      const today = `${String(yyyy)}-${mm}-${dd}`;

      // 1) Activa: startsOn=hoy, sin endsOn.
      await assignAs(ownerLogin.accessToken, TENANT_A_SLUG, routineA1Id, {
        studentId: studentA1.id,
        startsOn: today,
        weekdayMask: 1,
      });
      // 2) Expirada: ends_on=1999-01-01 (mucho antes de hoy).
      await assignAs(ownerLogin.accessToken, TENANT_A_SLUG, routineA1Id, {
        studentId: studentA1.id,
        startsOn: '1999-01-01',
        endsOn: '1999-12-31',
        weekdayMask: 1,
      });
      // 3) Futura: startsOn=2099-01-01.
      await assignAs(ownerLogin.accessToken, TENANT_A_SLUG, routineA1Id, {
        studentId: studentA1.id,
        startsOn: '2099-01-01',
        weekdayMask: 1,
      });

      const resAll = await request(app.getHttpServer())
        .get(`/students/${studentA1.id}/assignments`)
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      expect((resAll.body as AssignmentResponseBody[]).length).toBe(3);

      const resActive = await request(app.getHttpServer())
        .get(`/students/${studentA1.id}/assignments?status=active`)
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const active = resActive.body as AssignmentResponseBody[];
      expect(active.length).toBe(1);
      expect(active[0]!.status).toBe('active');

      const resExpired = await request(app.getHttpServer())
        .get(`/students/${studentA1.id}/assignments?status=expired`)
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      expect((resExpired.body as AssignmentResponseBody[]).length).toBe(1);
      expect((resExpired.body as AssignmentResponseBody[])[0]!.status).toBe(
        'expired',
      );

      const resFuture = await request(app.getHttpServer())
        .get(`/students/${studentA1.id}/assignments?status=future`)
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      expect((resFuture.body as AssignmentResponseBody[]).length).toBe(1);
    });

    it('filter status inválido → 400', async () => {
      const ownerLogin = await loginOwnerA();
      await request(app.getHttpServer())
        .get(`/students/${studentA1.id}/assignments?status=foo`)
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(400);
    });
  });

  // --------------------------------------------------------------------------
  // DELETE /assignments/:id
  // --------------------------------------------------------------------------
  describe('DELETE /assignments/:id', () => {
    it('OWNER borra → 204', async () => {
      const ownerLogin = await loginOwnerA();
      const a = await assignAs(
        ownerLogin.accessToken,
        TENANT_A_SLUG,
        routineA1Id,
        { studentId: studentA1.id, startsOn: '2026-05-18', weekdayMask: 1 },
      );

      await request(app.getHttpServer())
        .delete(`/assignments/${a.id}`)
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(204);

      const r = await dataSource
        .getRepository(Assignment)
        .findOne({ where: { id: a.id } });
      expect(r).toBeNull();
    });

    it('TRAINER borra assignment de su propio STUDENT → 204', async () => {
      const ownerLogin = await loginOwnerA();
      const a = await assignAs(
        ownerLogin.accessToken,
        TENANT_A_SLUG,
        routineA1Id,
        { studentId: studentA1.id, startsOn: '2026-05-18', weekdayMask: 1 },
      );

      const trainerLogin = await loginTrainerA();
      await request(app.getHttpServer())
        .delete(`/assignments/${a.id}`)
        .set('Authorization', `Bearer ${trainerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(204);
    });

    it('TRAINER borra assignment de STUDENT de otro trainer → 403', async () => {
      const trainerA2Login = await loginTrainerA2();
      const a = await assignAs(
        trainerA2Login.accessToken,
        TENANT_A_SLUG,
        routineA1Id,
        { studentId: studentA2.id, startsOn: '2026-05-18', weekdayMask: 1 },
      );

      const trainerLogin = await loginTrainerA();
      const res = await request(app.getHttpServer())
        .delete(`/assignments/${a.id}`)
        .set('Authorization', `Bearer ${trainerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE_HIERARCHY');

      // En DB sigue vivo.
      const r = await dataSource
        .getRepository(Assignment)
        .findOne({ where: { id: a.id } });
      expect(r).not.toBeNull();
    });

    it('STUDENT intenta borrar → 403 FORBIDDEN_ROLE', async () => {
      const ownerLogin = await loginOwnerA();
      const a = await assignAs(
        ownerLogin.accessToken,
        TENANT_A_SLUG,
        routineA1Id,
        { studentId: studentA1.id, startsOn: '2026-05-18', weekdayMask: 1 },
      );

      const studentLogin = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .delete(`/assignments/${a.id}`)
        .set('Authorization', `Bearer ${studentLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
    });

    it('id inexistente → 404 ASSIGNMENT_NOT_FOUND', async () => {
      const ownerLogin = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .delete('/assignments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('ASSIGNMENT_NOT_FOUND');
    });

    it('Cross-tenant DELETE → 404 (no afecta al otro tenant)', async () => {
      const ownerBLogin = await loginOwnerB();
      // Necesitamos crear un assignment en B. studentB tiene trainerId=ownerB
      // (workaround del fixture) — ownerB en su tenant es OWNER, así que puede
      // asignar a cualquier STUDENT del tenant B.
      const a = await assignAs(
        ownerBLogin.accessToken,
        TENANT_B_SLUG,
        routineB1Id,
        { studentId: studentB.id, startsOn: '2026-05-18', weekdayMask: 1 },
      );

      const ownerALogin = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .delete(`/assignments/${a.id}`)
        .set('Authorization', `Bearer ${ownerALogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('ASSIGNMENT_NOT_FOUND');

      const r = await dataSource
        .getRepository(Assignment)
        .findOne({ where: { id: a.id } });
      expect(r).not.toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // DELETE /routines/:id con assignments → 409 ROUTINE_HAS_ASSIGNMENTS
  // --------------------------------------------------------------------------
  describe('DELETE /routines/:id con assignments (Step 17 cross-cutting)', () => {
    it('intentar borrar routine con assignment → 409 ROUTINE_HAS_ASSIGNMENTS', async () => {
      const ownerLogin = await loginOwnerA();
      await assignAs(ownerLogin.accessToken, TENANT_A_SLUG, routineA1Id, {
        studentId: studentA1.id,
        startsOn: '2026-05-18',
        weekdayMask: 1,
      });

      const res = await request(app.getHttpServer())
        .delete(`/routines/${routineA1Id}`)
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(409);
      expect((res.body as ErrorBody).code).toBe('ROUTINE_HAS_ASSIGNMENTS');
    });

    it('después de borrar las assignments, sí se puede borrar la routine', async () => {
      const ownerLogin = await loginOwnerA();
      const a = await assignAs(
        ownerLogin.accessToken,
        TENANT_A_SLUG,
        routineA1Id,
        { studentId: studentA1.id, startsOn: '2026-05-18', weekdayMask: 1 },
      );

      await request(app.getHttpServer())
        .delete(`/assignments/${a.id}`)
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/routines/${routineA1Id}`)
        .set('Authorization', `Bearer ${ownerLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(204);
    });
  });
});
