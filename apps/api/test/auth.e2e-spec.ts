import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { PasswordService } from './../src/modules/auth/password.service';
import { seedSuperadmin } from './../src/modules/auth/seed-superadmin';
import { Tenant } from './../src/modules/tenants/entities/tenant.entity';
import { User } from './../src/modules/users/entities/user.entity';
import { UsersService } from './../src/modules/users/users.service';

interface LoginResponseBody {
  accessToken: string;
  user: {
    id: string;
    role: 'OWNER' | 'TRAINER' | 'STUDENT' | null;
    isSuperadmin: boolean;
    mustChangePassword: boolean;
    firstName: string;
    lastName: string;
    tenant: { id: string; slug: string; name: string } | null;
  };
}

interface ErrorBody {
  statusCode: number;
  code?: string;
  message?: string | string[];
}

const loginBody = (res: request.Response): LoginResponseBody =>
  res.body as LoginResponseBody;
const errBody = (res: request.Response): ErrorBody => res.body as ErrorBody;

const SUPERADMIN_EMAIL = 'super@rutinex.app';
const SUPERADMIN_PASSWORD = 'una-password-segura-larga';
const SUPERADMIN_HOST = 'superadmin.rutinex.app';
const TENANT_HOST = 'olimpo.rutinex.app';
const OWNER_PASSWORD = 'owner-password-1234';
const TRAINER_PASSWORD = 'trainer-password-1234';

describe('Auth — Steps 7 & 8 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersService: UsersService;
  let passwordService: PasswordService;
  let jwtService: JwtService;

  let superadmin: User;
  let tenant: Tenant;
  let owner: User;
  let trainerWithGeneratedPass: User;
  let trainerGeneratedPassword: string;
  let student: User;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    usersService = app.get(UsersService);
    passwordService = app.get(PasswordService);
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "users", "tenants" CASCADE');

    superadmin = await seedSuperadmin(usersService, passwordService, {
      email: SUPERADMIN_EMAIL,
      password: SUPERADMIN_PASSWORD,
    });

    const tenantRepo = dataSource.getRepository(Tenant);
    tenant = await tenantRepo.save(
      tenantRepo.create({
        slug: 'olimpo',
        name: 'Gimnasio Olimpo',
        branding: {},
        isActive: true,
      }),
    );

    owner = await usersService.create({
      tenantId: tenant.id,
      role: 'OWNER',
      email: 'owner@olimpo.test',
      passwordHash: await passwordService.hash(OWNER_PASSWORD),
      firstName: 'Olga',
      lastName: 'Owner',
    });

    // Trainer con password generada — simulamos el flujo F2 (alta de TRAINER).
    trainerGeneratedPassword = TRAINER_PASSWORD;
    trainerWithGeneratedPass = await usersService.create({
      tenantId: tenant.id,
      role: 'TRAINER',
      email: 'trainer@olimpo.test',
      passwordHash: await passwordService.hash(trainerGeneratedPassword),
      firstName: 'Tomi',
      lastName: 'Trainer',
      mustChangePassword: true,
    });

    student = await usersService.create({
      tenantId: tenant.id,
      role: 'STUDENT',
      dni: '12345678',
      firstName: 'Estu',
      lastName: 'Diante',
    });
  });

  // --------------------------------------------------------------------------
  // POST /auth/login — host SUPERADMIN (Step 7, no debe regresionar)
  // --------------------------------------------------------------------------

  describe('POST /auth/login (host SUPERADMIN)', () => {
    it('devuelve JWT y user con isSuperadmin=true', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', SUPERADMIN_HOST)
        .send({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD })
        .expect(200);

      const body = loginBody(res);
      expect(body.user).toMatchObject({
        id: superadmin.id,
        role: null,
        isSuperadmin: true,
        mustChangePassword: false,
        tenant: null,
      });

      const decoded = jwtService.verify<{
        sub: string;
        tenantId: null;
        role: null;
        isSuperadmin: boolean;
        exp: number;
        iat: number;
      }>(body.accessToken);
      expect(decoded.sub).toBe(superadmin.id);
      expect(decoded.tenantId).toBeNull();
      expect(decoded.role).toBeNull();
      expect(decoded.isSuperadmin).toBe(true);
      expect(decoded.exp - decoded.iat).toBe(15 * 60);
    });

    it('honra el override `x-rutinex-host`', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', 'localhost')
        .set('x-rutinex-host', 'superadmin.localhost')
        .send({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD })
        .expect(200);
    });

    it('401 con password incorrecta', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', SUPERADMIN_HOST)
        .send({ email: SUPERADMIN_EMAIL, password: 'mal' })
        .expect(401);
      expect(errBody(res)).toMatchObject({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('400 si el body es inválido', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', SUPERADMIN_HOST)
        .send({ email: 'no-email', password: '' })
        .expect(400);
    });
  });

  // --------------------------------------------------------------------------
  // POST /auth/login — host de tenant (Step 8)
  // --------------------------------------------------------------------------

  describe('POST /auth/login (host de tenant, OWNER/TRAINER)', () => {
    it('OWNER login OK → JWT con tenantId + role=OWNER', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email: owner.email, password: OWNER_PASSWORD })
        .expect(200);

      const body = loginBody(res);
      expect(body.user).toMatchObject({
        id: owner.id,
        role: 'OWNER',
        isSuperadmin: false,
        mustChangePassword: false,
        tenant: { id: tenant.id, slug: 'olimpo', name: 'Gimnasio Olimpo' },
      });

      const decoded = jwtService.verify<{
        sub: string;
        tenantId: string;
        role: 'OWNER' | 'TRAINER' | 'STUDENT';
        isSuperadmin: boolean;
      }>(body.accessToken);
      expect(decoded.sub).toBe(owner.id);
      expect(decoded.tenantId).toBe(tenant.id);
      expect(decoded.role).toBe('OWNER');
      expect(decoded.isSuperadmin).toBe(false);
    });

    it('TRAINER con password generada → mustChangePassword=true', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({
          email: trainerWithGeneratedPass.email,
          password: trainerGeneratedPassword,
        })
        .expect(200);
      expect(loginBody(res).user.mustChangePassword).toBe(true);
    });

    it('401 si el slug no existe (no se filtra existencia)', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', 'no-existe.rutinex.app')
        .send({ email: 'a@b.test', password: 'x123456789012' })
        .expect(401);
    });

    it('401 si el email no existe en el tenant', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email: 'fantasma@olimpo.test', password: 'x123456789012' })
        .expect(401);
    });

    it('401 con password incorrecta', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email: owner.email, password: 'mal' })
        .expect(401);
    });

    it('403 TENANT_INACTIVE si el tenant está pausado', async () => {
      await dataSource
        .getRepository(Tenant)
        .update({ id: tenant.id }, { isActive: false });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email: owner.email, password: OWNER_PASSWORD })
        .expect(403);
      expect(errBody(res)).toMatchObject({
        statusCode: 403,
        code: 'TENANT_INACTIVE',
      });
    });

    it('403 USER_INACTIVE si el user está pausado', async () => {
      await usersService.setActive(owner.id, false);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email: owner.email, password: OWNER_PASSWORD })
        .expect(403);
      expect(errBody(res)).toMatchObject({
        statusCode: 403,
        code: 'USER_INACTIVE',
      });
    });
  });

  // --------------------------------------------------------------------------
  // Cross-host (Step 7 + Step 8 endurecidos)
  // --------------------------------------------------------------------------

  describe('POST /auth/login (cross-host)', () => {
    it('SUPERADMIN desde host de tenant → 401 genérico', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD })
        .expect(401);
      expect(errBody(res)).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('OWNER desde host SUPERADMIN → 401 genérico', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', SUPERADMIN_HOST)
        .send({ email: owner.email, password: OWNER_PASSWORD })
        .expect(401);
      expect(errBody(res)).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });
  });

  // --------------------------------------------------------------------------
  // POST /auth/student-login
  // --------------------------------------------------------------------------

  describe('POST /auth/student-login', () => {
    it('login STUDENT OK → JWT con role=STUDENT, mustChangePassword=false', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/student-login')
        .set('Host', TENANT_HOST)
        .send({ dni: '12345678' })
        .expect(200);

      const body = loginBody(res);
      expect(body.user).toMatchObject({
        id: student.id,
        role: 'STUDENT',
        isSuperadmin: false,
        mustChangePassword: false,
        tenant: { id: tenant.id, slug: 'olimpo' },
      });

      const decoded = jwtService.verify<{
        sub: string;
        tenantId: string;
        role: string;
      }>(body.accessToken);
      expect(decoded.role).toBe('STUDENT');
      expect(decoded.tenantId).toBe(tenant.id);
    });

    it('401 desde el host SUPERADMIN (este endpoint no existe ahí)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/student-login')
        .set('Host', SUPERADMIN_HOST)
        .send({ dni: '12345678' })
        .expect(401);
      expect(errBody(res)).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('401 si el DNI no existe en el tenant', async () => {
      await request(app.getHttpServer())
        .post('/auth/student-login')
        .set('Host', TENANT_HOST)
        .send({ dni: '99999999' })
        .expect(401);
    });

    it('403 TENANT_INACTIVE si el tenant está pausado', async () => {
      await dataSource
        .getRepository(Tenant)
        .update({ id: tenant.id }, { isActive: false });
      const res = await request(app.getHttpServer())
        .post('/auth/student-login')
        .set('Host', TENANT_HOST)
        .send({ dni: '12345678' })
        .expect(403);
      expect(errBody(res)).toMatchObject({ code: 'TENANT_INACTIVE' });
    });

    it('403 USER_INACTIVE si el student está pausado', async () => {
      await usersService.setActive(student.id, false);
      const res = await request(app.getHttpServer())
        .post('/auth/student-login')
        .set('Host', TENANT_HOST)
        .send({ dni: '12345678' })
        .expect(403);
      expect(errBody(res)).toMatchObject({ code: 'USER_INACTIVE' });
    });

    it('400 con DNI inválido (no numérico)', async () => {
      await request(app.getHttpServer())
        .post('/auth/student-login')
        .set('Host', TENANT_HOST)
        .send({ dni: 'abc' })
        .expect(400);
    });
  });

  // --------------------------------------------------------------------------
  // POST /auth/change-password
  // --------------------------------------------------------------------------

  describe('POST /auth/change-password', () => {
    const login = async (
      email: string,
      password: string,
    ): Promise<LoginResponseBody> => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email, password })
        .expect(200);
      return loginBody(res);
    };

    it('401 sin Authorization header', async () => {
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .send({ newPassword: 'nueva-password-1234' })
        .expect(401);
    });

    it('flujo forzado completo: login con password generada → change → re-login limpio', async () => {
      // 1) login con la password generada → mustChangePassword=true
      const first = await login(
        trainerWithGeneratedPass.email!,
        trainerGeneratedPassword,
      );
      expect(first.user.mustChangePassword).toBe(true);

      // 2) change-password en modo forzado (sólo newPassword)
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${first.accessToken}`)
        .send({ newPassword: 'la-mia-segura-1234' })
        .expect(204);

      // 3) la password vieja deja de servir
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({
          email: trainerWithGeneratedPass.email,
          password: trainerGeneratedPassword,
        })
        .expect(401);

      // 4) la nueva password sirve y mustChangePassword pasa a false
      const second = await login(
        trainerWithGeneratedPass.email!,
        'la-mia-segura-1234',
      );
      expect(second.user.mustChangePassword).toBe(false);
    });

    it('modo voluntario: 400 si falta currentPassword', async () => {
      const { accessToken } = await login(owner.email!, OWNER_PASSWORD);

      const res = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newPassword: 'nueva-password-1234' })
        .expect(400);
      expect(errBody(res)).toMatchObject({
        code: 'CURRENT_PASSWORD_REQUIRED',
      });
    });

    it('modo voluntario: 401 con currentPassword incorrecta', async () => {
      const { accessToken } = await login(owner.email!, OWNER_PASSWORD);

      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'mal',
          newPassword: 'nueva-password-1234',
        })
        .expect(401);
    });

    it('modo voluntario: 204 con currentPassword correcta y la nueva pisa la vieja', async () => {
      const { accessToken } = await login(owner.email!, OWNER_PASSWORD);

      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: OWNER_PASSWORD,
          newPassword: 'la-nueva-1234',
        })
        .expect(204);

      // login con la vieja falla
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email: owner.email, password: OWNER_PASSWORD })
        .expect(401);

      // login con la nueva pasa
      await login(owner.email!, 'la-nueva-1234');
    });

    it('400 si la newPassword es muy corta (<12)', async () => {
      const { accessToken } = await login(
        trainerWithGeneratedPass.email!,
        trainerGeneratedPassword,
      );
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newPassword: 'corta' })
        .expect(400);
    });
  });

  // --------------------------------------------------------------------------
  // SuperadminGuard (Step 7, no debe regresionar con el global guard)
  // --------------------------------------------------------------------------

  describe('GET /superadmin/ping (SuperadminGuard)', () => {
    const signFor = async (payload: {
      sub: string;
      tenantId: string | null;
      role: 'OWNER' | 'TRAINER' | 'STUDENT' | null;
      isSuperadmin: boolean;
    }): Promise<string> => jwtService.signAsync(payload);

    it('200 con JWT de SUPERADMIN', async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', SUPERADMIN_HOST)
        .send({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/superadmin/ping')
        .set('Authorization', `Bearer ${loginBody(login).accessToken}`)
        .expect(200);
      expect(res.body).toEqual({ ok: true, userId: superadmin.id });
    });

    it('401 sin Authorization header', async () => {
      await request(app.getHttpServer()).get('/superadmin/ping').expect(401);
    });

    it('401 con token inválido', async () => {
      await request(app.getHttpServer())
        .get('/superadmin/ping')
        .set('Authorization', 'Bearer not-a-real-jwt')
        .expect(401);
    });

    it('403 con JWT no-superadmin (OWNER) — NOT_SUPERADMIN', async () => {
      const token = await signFor({
        sub: owner.id,
        tenantId: owner.tenantId,
        role: 'OWNER',
        isSuperadmin: false,
      });
      const res = await request(app.getHttpServer())
        .get('/superadmin/ping')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(errBody(res)).toMatchObject({
        statusCode: 403,
        code: 'NOT_SUPERADMIN',
      });
    });
  });
});
