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
import { PersonalRecord } from './../src/modules/personal-records/entities/personal-record.entity';
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

interface SessionResponseBody {
  id: string;
}

interface PersonalRecordBody {
  id: string;
  studentId: string;
  exerciseId: string;
  recordType: 'max_weight' | 'max_reps_at_weight' | 'max_volume';
  weightKg: number;
  reps: number;
  achievedAt: string;
  setId: string;
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

describe('Personal Records — Step 19 (e2e)', () => {
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
  let trainerA2: User;
  let studentA1: User;
  let studentA2: User;
  let studentA3: User; // de trainerA2

  let tenantB: Tenant;
  let ownerB: User;
  let studentB: User;
  let exerciseAId: string;
  let exerciseBId: string;
  let routineAId: string;
  let routineItemA1Id: string;
  let routineItemA2Id: string; // segundo item del mismo routine (mismo exercise)
  let assignmentA1Id: string;
  let assignmentA3Id: string;

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
      'TRUNCATE TABLE "personal_records", "sets", "sessions", "assignments", "routine_items", "routines", "exercises", "refresh_tokens", "users", "tenants" CASCADE',
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
      firstName: 'Other',
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
    studentA3 = await usersService.create({
      tenantId: tenantA.id,
      role: 'STUDENT',
      dni: '33333333',
      firstName: 'Third',
      lastName: 'Alumno',
      trainerId: trainerA2.id,
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
      dni: '44444444',
      firstName: 'Spartan',
      lastName: 'Student',
      trainerId: ownerB.id,
    });

    const exA = await exercisesService.create(tenantA.id, ownerA.id, {
      title: 'Press de banca',
      mediaType: 'none',
      muscleGroups: ['chest'],
    });
    exerciseAId = exA.id;
    // Routine con 2 items apuntando al mismo exercise — necesario para el test
    // de concurrencia (dos POST /sets simultáneos sobre el mismo exercise).
    const routA = await routinesService.create(tenantA.id, ownerA.id, {
      name: 'Tren superior',
      items: [
        {
          exerciseId: exA.id,
          position: 1,
          prescribedSets: 3,
          prescribedReps: '10',
        },
        {
          exerciseId: exA.id,
          position: 2,
          prescribedSets: 3,
          prescribedReps: '8',
        },
      ],
    });
    routineAId = routA.id;
    routineItemA1Id = routA.items[0]!.id;
    routineItemA2Id = routA.items[1]!.id;

    const exB = await exercisesService.create(tenantB.id, ownerB.id, {
      title: 'Press spartan',
      mediaType: 'none',
      muscleGroups: ['chest'],
    });
    exerciseBId = exB.id;
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

    const aA1 = await assignmentsService.createForRoutine(
      tenantA.id,
      {
        userId: ownerA.id,
        tenantId: tenantA.id,
        role: 'OWNER',
        isSuperadmin: false,
      },
      routA.id,
      { studentId: studentA1.id, startsOn: todayStr(), weekdayMask: 127 },
    );
    assignmentA1Id = aA1.id;

    const aA3 = await assignmentsService.createForRoutine(
      tenantA.id,
      {
        userId: ownerA.id,
        tenantId: tenantA.id,
        role: 'OWNER',
        isSuperadmin: false,
      },
      routA.id,
      { studentId: studentA3.id, startsOn: todayStr(), weekdayMask: 127 },
    );
    assignmentA3Id = aA3.id;

    await assignmentsService.createForRoutine(
      tenantB.id,
      {
        userId: ownerB.id,
        tenantId: tenantB.id,
        role: 'OWNER',
        isSuperadmin: false,
      },
      routB.id,
      { studentId: studentB.id, startsOn: todayStr(), weekdayMask: 127 },
    );
  });

  // ---------- helpers --------------------------------------------------------
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
  const loginStudentA2 = (): Promise<LoginResponseBody> =>
    loginAs(TENANT_A_HOST, { dni: studentA2.dni! }, '/auth/student-login');
  const loginStudentA3 = (): Promise<LoginResponseBody> =>
    loginAs(TENANT_A_HOST, { dni: studentA3.dni! }, '/auth/student-login');

  const openSession = async (
    token: string,
    assignmentId: string,
  ): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-slug', TENANT_A_SLUG)
      .send({ assignmentId })
      .expect(201);
    return (res.body as SessionResponseBody).id;
  };

  const postSet = (
    token: string,
    sessionId: string,
    body: {
      routineItemId: string;
      setNumber: number;
      reps: number;
      weightKg?: number | null;
    },
    expectedStatus = 201,
  ): request.Test =>
    request(app.getHttpServer())
      .post(`/sessions/${sessionId}/sets`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-slug', TENANT_A_SLUG)
      .send(body)
      .expect(expectedStatus);

  // ---------------------------------------------------------------------------
  // Cálculo: PR se crea al subir el primer set calificado
  // ---------------------------------------------------------------------------
  describe('Cálculo de PR dentro de addSet', () => {
    it('Primer set crea los 3 PRs (max_weight / max_reps_at_weight / max_volume)', async () => {
      const { accessToken } = await loginStudentA1();
      const sessionId = await openSession(accessToken, assignmentA1Id);
      await postSet(accessToken, sessionId, {
        routineItemId: routineItemA1Id,
        setNumber: 1,
        reps: 10,
        weightKg: 80,
      });

      const prs = await dataSource.getRepository(PersonalRecord).find({
        where: { tenantId: tenantA.id, studentId: studentA1.id },
        order: { recordType: 'ASC' },
      });
      expect(prs).toHaveLength(3);
      const byType = new Map(prs.map((pr) => [pr.recordType, pr]));
      expect(byType.get('max_weight')!.weightKg).toBe('80.00');
      expect(byType.get('max_weight')!.reps).toBe(10);
      expect(byType.get('max_reps_at_weight')!.reps).toBe(10);
      expect(byType.get('max_volume')!.weightKg).toBe('80.00');
      expect(byType.get('max_volume')!.reps).toBe(10);
    });

    it('Set siguiente con más peso → max_weight se actualiza; max_reps_at_weight se mantiene si reps no supera', async () => {
      const { accessToken } = await loginStudentA1();
      const sessionId = await openSession(accessToken, assignmentA1Id);
      await postSet(accessToken, sessionId, {
        routineItemId: routineItemA1Id,
        setNumber: 1,
        reps: 10,
        weightKg: 80,
      });
      await postSet(accessToken, sessionId, {
        routineItemId: routineItemA1Id,
        setNumber: 2,
        reps: 5,
        weightKg: 100,
      });

      const repo = dataSource.getRepository(PersonalRecord);
      const maxWeight = await repo.findOne({
        where: {
          tenantId: tenantA.id,
          studentId: studentA1.id,
          recordType: 'max_weight',
        },
      });
      expect(maxWeight!.weightKg).toBe('100.00');
      expect(maxWeight!.reps).toBe(5);

      const maxReps = await repo.findOne({
        where: {
          tenantId: tenantA.id,
          studentId: studentA1.id,
          recordType: 'max_reps_at_weight',
        },
      });
      // El set de 5 reps no supera al de 10 reps anterior.
      expect(maxReps!.reps).toBe(10);
      expect(maxReps!.weightKg).toBe('80.00');

      const maxVol = await repo.findOne({
        where: {
          tenantId: tenantA.id,
          studentId: studentA1.id,
          recordType: 'max_volume',
        },
      });
      // 100kg × 5 reps = 500 > 80kg × 10 reps = 800? No: 800 > 500. Se mantiene
      // el primero (80 × 10).
      expect(maxVol!.weightKg).toBe('80.00');
      expect(maxVol!.reps).toBe(10);
    });

    it('Empate exacto (hard-PR) → no se actualiza el achieved_at ni el set_id', async () => {
      const { accessToken } = await loginStudentA1();
      const sessionId = await openSession(accessToken, assignmentA1Id);
      await postSet(accessToken, sessionId, {
        routineItemId: routineItemA1Id,
        setNumber: 1,
        reps: 10,
        weightKg: 80,
      });

      const repo = dataSource.getRepository(PersonalRecord);
      const before = await repo.findOne({
        where: {
          tenantId: tenantA.id,
          studentId: studentA1.id,
          recordType: 'max_weight',
        },
      });

      // Segundo set: mismo peso, mismas reps. Tie — el row no debería tocarse.
      await postSet(accessToken, sessionId, {
        routineItemId: routineItemA1Id,
        setNumber: 2,
        reps: 10,
        weightKg: 80,
      });

      const after = await repo.findOne({
        where: {
          tenantId: tenantA.id,
          studentId: studentA1.id,
          recordType: 'max_weight',
        },
      });
      expect(after!.id).toBe(before!.id);
      expect(after!.setId).toBe(before!.setId);
      expect(after!.achievedAt.toISOString()).toBe(
        before!.achievedAt.toISOString(),
      );
    });

    it('Set con weightKg=null (bodyweight) → no se crean PRs', async () => {
      const { accessToken } = await loginStudentA1();
      const sessionId = await openSession(accessToken, assignmentA1Id);
      await postSet(accessToken, sessionId, {
        routineItemId: routineItemA1Id,
        setNumber: 1,
        reps: 20,
        weightKg: null,
      });
      const count = await dataSource.getRepository(PersonalRecord).count({
        where: { tenantId: tenantA.id, studentId: studentA1.id },
      });
      expect(count).toBe(0);
    });

    it('PRs son por (student, exercise) — student A2 no hereda PRs de A1', async () => {
      const a1Login = await loginStudentA1();
      const s1 = await openSession(a1Login.accessToken, assignmentA1Id);
      await postSet(a1Login.accessToken, s1, {
        routineItemId: routineItemA1Id,
        setNumber: 1,
        reps: 10,
        weightKg: 80,
      });

      // Crear assignment activa para studentA2 sobre la misma routine y
      // arrancar su propia sesión.
      const newAssign = await assignmentsService.createForRoutine(
        tenantA.id,
        {
          userId: ownerA.id,
          tenantId: tenantA.id,
          role: 'OWNER',
          isSuperadmin: false,
        },
        routineAId,
        { studentId: studentA2.id, startsOn: todayStr(), weekdayMask: 127 },
      );
      const a2Login = await loginStudentA2();
      const s2 = await openSession(a2Login.accessToken, newAssign.id);
      // A2 sólo levanta 40 kg
      await postSet(a2Login.accessToken, s2, {
        routineItemId: routineItemA1Id,
        setNumber: 1,
        reps: 8,
        weightKg: 40,
      });

      const repo = dataSource.getRepository(PersonalRecord);
      const prA1 = await repo.find({
        where: { tenantId: tenantA.id, studentId: studentA1.id },
      });
      const prA2 = await repo.find({
        where: { tenantId: tenantA.id, studentId: studentA2.id },
      });
      expect(prA1).toHaveLength(3);
      expect(prA2).toHaveLength(3);
      const a2MaxWeight = prA2.find((p) => p.recordType === 'max_weight');
      expect(a2MaxWeight!.weightKg).toBe('40.00');
    });
  });

  // ---------------------------------------------------------------------------
  // Concurrencia: dos POST /sets simultáneos
  // ---------------------------------------------------------------------------
  describe('Concurrencia', () => {
    it('Promise.all de 2 sets sobre el mismo (student, exercise) → 1 PR final con el mejor valor', async () => {
      const { accessToken } = await loginStudentA1();
      const sessionId = await openSession(accessToken, assignmentA1Id);

      // Dos POST /sets en paralelo: routine_item distinto (para no chocar con
      // SET_NUMBER_DUPLICATED), mismo exercise (mismo PR target).
      // El set 1 levanta 100kg × 5; el set 2 levanta 90kg × 8.
      const [res1, res2] = await Promise.all([
        postSet(accessToken, sessionId, {
          routineItemId: routineItemA1Id,
          setNumber: 1,
          reps: 5,
          weightKg: 100,
        }),
        postSet(accessToken, sessionId, {
          routineItemId: routineItemA2Id,
          setNumber: 1,
          reps: 8,
          weightKg: 90,
        }),
      ]);
      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      const repo = dataSource.getRepository(PersonalRecord);
      // El UNIQUE compuesto garantiza 1 row por (student, exercise, record_type).
      const prs = await repo.find({
        where: { tenantId: tenantA.id, studentId: studentA1.id },
        order: { recordType: 'ASC' },
      });
      expect(prs).toHaveLength(3);
      const byType = new Map(prs.map((p) => [p.recordType, p]));
      // max_weight: gana 100kg.
      expect(byType.get('max_weight')!.weightKg).toBe('100.00');
      // max_reps_at_weight: gana 8 reps.
      expect(byType.get('max_reps_at_weight')!.reps).toBe(8);
      expect(byType.get('max_reps_at_weight')!.weightKg).toBe('90.00');
      // max_volume: max(100×5=500, 90×8=720) = 720.
      expect(byType.get('max_volume')!.weightKg).toBe('90.00');
      expect(byType.get('max_volume')!.reps).toBe(8);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /students/:studentId/personal-records
  // ---------------------------------------------------------------------------
  describe('GET /students/:studentId/personal-records', () => {
    /** Sube 1 set con weightKg=W, reps=R para el student dado. */
    const seedOneSet = async (
      studentLogin: LoginResponseBody,
      assignmentId: string,
      weight: number,
      reps: number,
    ): Promise<void> => {
      const sessionId = await openSession(
        studentLogin.accessToken,
        assignmentId,
      );
      await postSet(studentLogin.accessToken, sessionId, {
        routineItemId: routineItemA1Id,
        setNumber: 1,
        reps,
        weightKg: weight,
      });
    };

    it('OWNER lee todos los PRs del student', async () => {
      const studLogin = await loginStudentA1();
      await seedOneSet(studLogin, assignmentA1Id, 80, 10);

      const owner = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .get(`/students/${studentA1.id}/personal-records`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as PersonalRecordBody[];
      expect(body).toHaveLength(3);
      for (const pr of body) {
        expect(pr.studentId).toBe(studentA1.id);
        expect(pr.exerciseId).toBe(exerciseAId);
        expect(typeof pr.weightKg).toBe('number');
      }
    });

    it('TRAINER lee PRs de su propio student', async () => {
      const studLogin = await loginStudentA1();
      await seedOneSet(studLogin, assignmentA1Id, 80, 10);

      const trainer = await loginTrainerA();
      const res = await request(app.getHttpServer())
        .get(`/students/${studentA1.id}/personal-records`)
        .set('Authorization', `Bearer ${trainer.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      expect((res.body as PersonalRecordBody[]).length).toBe(3);
    });

    it('TRAINER intenta leer PRs de un student de otro TRAINER → 403', async () => {
      const studLogin = await loginStudentA3();
      await seedOneSet(studLogin, assignmentA3Id, 50, 12);

      const trainer = await loginTrainerA();
      const res = await request(app.getHttpServer())
        .get(`/students/${studentA3.id}/personal-records`)
        .set('Authorization', `Bearer ${trainer.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE_HIERARCHY');
    });

    it('STUDENT lee sus propios PRs', async () => {
      const studLogin = await loginStudentA1();
      await seedOneSet(studLogin, assignmentA1Id, 60, 12);
      const res = await request(app.getHttpServer())
        .get(`/students/${studentA1.id}/personal-records`)
        .set('Authorization', `Bearer ${studLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      expect((res.body as PersonalRecordBody[]).length).toBe(3);
    });

    it('STUDENT intenta leer PRs de otro student → 403', async () => {
      const studLogin = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .get(`/students/${studentA2.id}/personal-records`)
        .set('Authorization', `Bearer ${studLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE_HIERARCHY');
    });

    it('studentId inexistente → 404 STUDENT_NOT_FOUND', async () => {
      const owner = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .get('/students/00000000-0000-0000-0000-000000000000/personal-records')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('STUDENT_NOT_FOUND');
    });

    it('Cross-tenant (student de tenant B) → 404 STUDENT_NOT_FOUND', async () => {
      const owner = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .get(`/students/${studentB.id}/personal-records`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('STUDENT_NOT_FOUND');
    });

    it('Sin bearer → 401', async () => {
      await request(app.getHttpServer())
        .get(`/students/${studentA1.id}/personal-records`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(401);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /students/:studentId/personal-records/:exerciseId
  // ---------------------------------------------------------------------------
  describe('GET /students/:studentId/personal-records/:exerciseId', () => {
    it('Filtra por exercise → solo PRs de ese exercise', async () => {
      const studLogin = await loginStudentA1();
      const sessionId = await openSession(
        studLogin.accessToken,
        assignmentA1Id,
      );
      await postSet(studLogin.accessToken, sessionId, {
        routineItemId: routineItemA1Id,
        setNumber: 1,
        reps: 10,
        weightKg: 80,
      });

      const res = await request(app.getHttpServer())
        .get(`/students/${studentA1.id}/personal-records/${exerciseAId}`)
        .set('Authorization', `Bearer ${studLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as PersonalRecordBody[];
      expect(body).toHaveLength(3);
      for (const pr of body) {
        expect(pr.exerciseId).toBe(exerciseAId);
      }
    });

    it('exerciseId sin PRs (sin sets sobre ese ejercicio) → array vacío', async () => {
      const studLogin = await loginStudentA1();
      const res = await request(app.getHttpServer())
        .get(
          `/students/${studentA1.id}/personal-records/00000000-0000-0000-0000-000000000000`,
        )
        .set('Authorization', `Bearer ${studLogin.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('TRAINER de otro student → 403', async () => {
      const trainer = await loginTrainerA();
      const res = await request(app.getHttpServer())
        .get(`/students/${studentA3.id}/personal-records/${exerciseAId}`)
        .set('Authorization', `Bearer ${trainer.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE_HIERARCHY');
    });

    it('TRAINER del student lee → 200', async () => {
      const trainer = await loginTrainerA2();
      const res = await request(app.getHttpServer())
        .get(`/students/${studentA3.id}/personal-records/${exerciseAId}`)
        .set('Authorization', `Bearer ${trainer.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      // Sin sets ejecutados, lista vacía.
      expect(res.body).toEqual([]);
    });

    it('Cross-tenant: usar exerciseId de tenant B desde tenant A → array vacío', async () => {
      // El student existe en A pero el exerciseId es de B — la query filtra
      // por (tenantId del JWT, exerciseId) y devuelve vacío.
      const owner = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .get(`/students/${studentA1.id}/personal-records/${exerciseBId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      expect(res.body).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Cross-cutting: pseudo-cleanup. Sirve para confirmar que el FK RESTRICT
  // a sets bloquea borrar un set referenciado por un PR.
  // ---------------------------------------------------------------------------
  describe('FK personal_records.set_id = RESTRICT', () => {
    it('Intentar borrar el set del PR → 23503', async () => {
      const { accessToken } = await loginStudentA1();
      const sessionId = await openSession(accessToken, assignmentA1Id);
      await postSet(accessToken, sessionId, {
        routineItemId: routineItemA1Id,
        setNumber: 1,
        reps: 10,
        weightKg: 80,
      });

      const setRow = await dataSource.query<{ id: string }[]>(
        `SELECT id FROM sets WHERE session_id = $1 LIMIT 1`,
        [sessionId],
      );
      const setId = setRow[0]!.id;
      await expect(
        dataSource.query(`DELETE FROM sets WHERE id = $1`, [setId]),
      ).rejects.toMatchObject({ code: '23503' });
    });
  });
});
