import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { PasswordService } from './../src/modules/auth/password.service';
import { RefreshToken } from './../src/modules/auth/entities/refresh-token.entity';
import { seedSuperadmin } from './../src/modules/auth/seed-superadmin';
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

interface UserResponseBody {
  id: string;
  role: 'OWNER' | 'TRAINER' | 'STUDENT' | null;
  email: string | null;
  dni: string | null;
  firstName: string;
  lastName: string;
  trainerId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateUserResponseBody {
  user: UserResponseBody;
  generatedPassword?: string;
}

interface PaginatedUsersBody {
  data: UserResponseBody[];
  page: number;
  pageSize: number;
  total: number;
}

interface ResetPasswordBody {
  generatedPassword: string;
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
const OTHER_TRAINER_PASSWORD = 'otro-trainer-pass-1234';

describe('Users CRUD — Step 12 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersService: UsersService;
  let passwordService: PasswordService;

  let tenantA: Tenant;
  let ownerA: User;
  let trainerA: User;
  let otherTrainerA: User;
  let studentA: User;
  let otherStudentA: User; // del otherTrainerA

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
      'TRUNCATE TABLE "refresh_tokens", "users", "tenants" CASCADE',
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
    otherTrainerA = await usersService.create({
      tenantId: tenantA.id,
      role: 'TRAINER',
      email: 'otrotrainer@olimpo.test',
      passwordHash: await passwordService.hash(OTHER_TRAINER_PASSWORD),
      firstName: 'Otro',
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
    otherStudentA = await usersService.create({
      tenantId: tenantA.id,
      role: 'STUDENT',
      dni: '22222222',
      firstName: 'Otro',
      lastName: 'Alumno',
      trainerId: otherTrainerA.id,
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

  // --------------------------------------------------------------------------
  // POST /users — crear TRAINER (por OWNER)
  // --------------------------------------------------------------------------
  describe('POST /users — crear TRAINER (OWNER)', () => {
    it('OWNER crea TRAINER → 201 con generatedPassword + must_change_password=true', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          role: 'TRAINER',
          email: 'nuevo@trainer.test',
          firstName: 'Nuevo',
          lastName: 'Trainer',
        })
        .expect(201);

      const body = res.body as CreateUserResponseBody;
      expect(body.user.role).toBe('TRAINER');
      expect(body.user.email).toBe('nuevo@trainer.test');
      expect(body.user.mustChangePassword).toBe(true);
      expect(body.user.trainerId).toBeNull();
      expect(typeof body.generatedPassword).toBe('string');
      expect(body.generatedPassword!.length).toBe(16);

      // El nuevo trainer puede loguearse con esa password.
      const login = await loginAs(TENANT_A_HOST, {
        email: 'nuevo@trainer.test',
        password: body.generatedPassword!,
      });
      expect(login.user.mustChangePassword).toBe(true);
      expect(login.user.role).toBe('TRAINER');
    });

    it('TRAINER intentando crear TRAINER → 403 FORBIDDEN_ROLE_HIERARCHY', async () => {
      const { accessToken } = await loginTrainerA();
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          role: 'TRAINER',
          email: 'x@y.test',
          firstName: 'X',
          lastName: 'Y',
        })
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE_HIERARCHY');
    });

    it('email duplicado en el mismo tenant → 409 EMAIL_TAKEN', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          role: 'TRAINER',
          email: trainerA.email!,
          firstName: 'Dup',
          lastName: 'E',
        })
        .expect(409);
      expect((res.body as ErrorBody).code).toBe('EMAIL_TAKEN');
    });

    it('DTO inválido (sin email) → 400', async () => {
      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          role: 'TRAINER',
          firstName: 'X',
          lastName: 'Y',
        })
        .expect(400);
    });
  });

  // --------------------------------------------------------------------------
  // POST /users — crear STUDENT (por TRAINER)
  // --------------------------------------------------------------------------
  describe('POST /users — crear STUDENT (TRAINER)', () => {
    it('TRAINER crea STUDENT → 201 con trainerId = trainerA.id, sin generatedPassword', async () => {
      const { accessToken } = await loginTrainerA();
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          role: 'STUDENT',
          dni: '99887766',
          firstName: 'Nuevo',
          lastName: 'Alumno',
        })
        .expect(201);

      const body = res.body as CreateUserResponseBody;
      expect(body.user.role).toBe('STUDENT');
      expect(body.user.dni).toBe('99887766');
      expect(body.user.trainerId).toBe(trainerA.id);
      expect(body.user.mustChangePassword).toBe(false);
      expect(body.generatedPassword).toBeUndefined();
    });

    it('OWNER intentando crear STUDENT → 403 FORBIDDEN_ROLE_HIERARCHY', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          role: 'STUDENT',
          dni: '33333333',
          firstName: 'X',
          lastName: 'Y',
        })
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE_HIERARCHY');
    });

    it('TRAINER sin DNI → 400', async () => {
      const { accessToken } = await loginTrainerA();
      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          role: 'STUDENT',
          firstName: 'X',
          lastName: 'Y',
        })
        .expect(400);
    });

    it('STUDENT intentando crear cualquier user → 403 FORBIDDEN_ROLE (RolesGuard)', async () => {
      const { accessToken } = await loginStudentA();
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({
          role: 'STUDENT',
          dni: '99999999',
          firstName: 'X',
          lastName: 'Y',
        })
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
    });

    it('sin x-tenant-slug → 400 TENANT_SLUG_REQUIRED', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          role: 'TRAINER',
          email: 'x@y.test',
          firstName: 'X',
          lastName: 'Y',
        })
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('TENANT_SLUG_REQUIRED');
    });
  });

  // --------------------------------------------------------------------------
  // GET /users — listado con scope por rol
  // --------------------------------------------------------------------------
  describe('GET /users', () => {
    it('OWNER ve todos los users del tenant (5 en tenant A)', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as PaginatedUsersBody;
      expect(body.total).toBe(5);
      const ids = body.data.map((u) => u.id).sort();
      expect(ids).toEqual(
        [
          ownerA.id,
          trainerA.id,
          otherTrainerA.id,
          studentA.id,
          otherStudentA.id,
        ].sort(),
      );
    });

    it('TRAINER ve sus students + a sí mismo (no otros trainers ni OWNER)', async () => {
      const { accessToken } = await loginTrainerA();
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as PaginatedUsersBody;
      const ids = body.data.map((u) => u.id).sort();
      expect(ids).toEqual([trainerA.id, studentA.id].sort());
      expect(body.total).toBe(2);
    });

    it('Filtro role=STUDENT con OWNER → solo students', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .get('/users?role=STUDENT')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as PaginatedUsersBody;
      expect(body.data.every((u) => u.role === 'STUDENT')).toBe(true);
      expect(body.total).toBe(2);
    });

    it('Filtro role=TRAINER con TRAINER → solo self (no otros trainers)', async () => {
      const { accessToken } = await loginTrainerA();
      const res = await request(app.getHttpServer())
        .get('/users?role=TRAINER')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as PaginatedUsersBody;
      expect(body.total).toBe(1);
      expect(body.data[0]!.id).toBe(trainerA.id);
    });

    it('Paginación page=1 pageSize=2 funciona', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .get('/users?page=1&pageSize=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as PaginatedUsersBody;
      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(2);
      expect(body.total).toBe(5);
      expect(body.data.length).toBe(2);
    });

    it('Filtro isActive=false → solo inactivos', async () => {
      await usersService.setActive(studentA.id, false);
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .get('/users?isActive=false')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);
      const body = res.body as PaginatedUsersBody;
      expect(body.total).toBe(1);
      expect(body.data[0]!.id).toBe(studentA.id);
    });

    it('STUDENT → 403 FORBIDDEN_ROLE', async () => {
      const { accessToken } = await loginStudentA();
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
    });

    it('Cross-tenant: OWNER de B con slug A → 403 TENANT_MISMATCH', async () => {
      const { accessToken } = await loginOwnerB();
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('TENANT_MISMATCH');
    });
  });

  // --------------------------------------------------------------------------
  // PATCH /users/:id
  // --------------------------------------------------------------------------
  describe('PATCH /users/:id', () => {
    it('OWNER actualiza nombre de TRAINER → 200', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .patch(`/users/${trainerA.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ firstName: 'Nombre Nuevo' })
        .expect(200);
      expect((res.body as UserResponseBody).firstName).toBe('Nombre Nuevo');
    });

    it('TRAINER actualiza su propio STUDENT → 200', async () => {
      const { accessToken } = await loginTrainerA();
      await request(app.getHttpServer())
        .patch(`/users/${studentA.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ firstName: 'Modificado' })
        .expect(200);
    });

    it('TRAINER intentando actualizar STUDENT de otro TRAINER → 403 FORBIDDEN_ROLE_HIERARCHY', async () => {
      const { accessToken } = await loginTrainerA();
      const res = await request(app.getHttpServer())
        .patch(`/users/${otherStudentA.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ firstName: 'X' })
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE_HIERARCHY');
    });

    it('TRAINER intentando actualizar al OWNER → 403 FORBIDDEN_ROLE_HIERARCHY', async () => {
      const { accessToken } = await loginTrainerA();
      await request(app.getHttpServer())
        .patch(`/users/${ownerA.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ firstName: 'X' })
        .expect(403);
    });

    it('Desactivar user (isActive=false) revoca refresh tokens del user', async () => {
      const studentLogin = await loginStudentA();
      // verificamos que tiene refresh activo
      const refreshRepo = dataSource.getRepository(RefreshToken);
      const before = await refreshRepo.find({
        where: { userId: studentA.id },
      });
      expect(before.length).toBe(1);
      expect(before[0]!.revokedAt).toBeNull();

      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .patch(`/users/${studentA.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ isActive: false })
        .expect(200);

      const after = await refreshRepo.find({
        where: { userId: studentA.id },
      });
      expect(after[0]!.revokedAt).not.toBeNull();

      // El refresh ya no rota.
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Host', TENANT_A_HOST)
        .send({ refreshToken: studentLogin.refreshToken })
        .expect(401);
    });

    it('user inexistente → 404 USER_NOT_FOUND', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .patch(`/users/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ firstName: 'X' })
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('USER_NOT_FOUND');
    });

    it('id no-UUID → 400 (ParseUUIDPipe)', async () => {
      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .patch(`/users/no-uuid`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ firstName: 'X' })
        .expect(400);
    });

    it('Cross-tenant: OWNER de A con id de tenant B → 404 USER_NOT_FOUND (no se filtra existencia)', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .patch(`/users/${ownerB.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .send({ firstName: 'X' })
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('USER_NOT_FOUND');
    });
  });

  // --------------------------------------------------------------------------
  // POST /users/:id/reset-password
  // --------------------------------------------------------------------------
  describe('POST /users/:id/reset-password', () => {
    it('OWNER resetea TRAINER → 200 con generatedPassword, must_change_password=true, refresh revocados', async () => {
      const trainerLogin = await loginTrainerA();

      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post(`/users/${trainerA.id}/reset-password`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(200);

      const body = res.body as ResetPasswordBody;
      expect(typeof body.generatedPassword).toBe('string');
      expect(body.generatedPassword.length).toBe(16);

      // Vieja password no funciona; nueva sí.
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_A_HOST)
        .send({ email: trainerA.email!, password: TRAINER_PASSWORD })
        .expect(401);

      const newLogin = await loginAs(TENANT_A_HOST, {
        email: trainerA.email!,
        password: body.generatedPassword,
      });
      expect(newLogin.user.mustChangePassword).toBe(true);

      // Refresh tokens del trainer fueron revocados.
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Host', TENANT_A_HOST)
        .send({ refreshToken: trainerLogin.refreshToken })
        .expect(401);
    });

    it('OWNER intentando resetear STUDENT → 400 USER_NO_PASSWORD', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post(`/users/${studentA.id}/reset-password`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(400);
      expect((res.body as ErrorBody).code).toBe('USER_NO_PASSWORD');
    });

    it('OWNER intentando resetear OWNER → 403 FORBIDDEN_ROLE_HIERARCHY', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post(`/users/${ownerA.id}/reset-password`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE_HIERARCHY');
    });

    it('TRAINER intentando resetear (cualquier target) → 403 FORBIDDEN_ROLE (RolesGuard)', async () => {
      const { accessToken } = await loginTrainerA();
      const res = await request(app.getHttpServer())
        .post(`/users/${otherTrainerA.id}/reset-password`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
    });

    it('OWNER con id inexistente → 404 USER_NOT_FOUND', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .post(`/users/00000000-0000-0000-0000-000000000000/reset-password`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('USER_NOT_FOUND');
    });
  });

  // --------------------------------------------------------------------------
  // DELETE /users/:id (soft delete via isActive=false)
  // --------------------------------------------------------------------------
  describe('DELETE /users/:id', () => {
    it('OWNER borra TRAINER → 204, isActive=false, refresh revocados', async () => {
      const trainerLogin = await loginTrainerA();

      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .delete(`/users/${trainerA.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(204);

      const refreshed = await dataSource
        .getRepository(User)
        .findOne({ where: { id: trainerA.id } });
      expect(refreshed?.isActive).toBe(false);

      // Refresh del trainer revocado.
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Host', TENANT_A_HOST)
        .send({ refreshToken: trainerLogin.refreshToken })
        .expect(401);
    });

    it('OWNER borra STUDENT → 204', async () => {
      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .delete(`/users/${studentA.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(204);
    });

    it('OWNER intentando borrar OWNER → 403 FORBIDDEN_ROLE_HIERARCHY', async () => {
      const { accessToken } = await loginOwnerA();
      const res = await request(app.getHttpServer())
        .delete(`/users/${ownerA.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE_HIERARCHY');
    });

    it('TRAINER intentando borrar → 403 FORBIDDEN_ROLE (RolesGuard)', async () => {
      const { accessToken } = await loginTrainerA();
      const res = await request(app.getHttpServer())
        .delete(`/users/${studentA.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('FORBIDDEN_ROLE');
    });

    it('inexistente → 404', async () => {
      const { accessToken } = await loginOwnerA();
      await request(app.getHttpServer())
        .delete(`/users/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(404);
    });
  });

  // --------------------------------------------------------------------------
  // Auth requerido
  // --------------------------------------------------------------------------
  describe('auth requerido', () => {
    it('Sin bearer → 401', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .set('x-tenant-slug', TENANT_A_SLUG)
        .expect(401);
    });
  });
});
