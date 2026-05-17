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
    tenant: null;
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

describe('Auth — SUPERADMIN login + SuperadminGuard (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersService: UsersService;
  let passwordService: PasswordService;
  let jwtService: JwtService;

  let superadmin: User;
  let owner: User;

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

    // Bootstrap del SUPERADMIN vía el mismo helper que usa el CLI.
    superadmin = await seedSuperadmin(usersService, passwordService, {
      email: SUPERADMIN_EMAIL,
      password: SUPERADMIN_PASSWORD,
    });

    // Tenant + OWNER para el caso cross-host y para el 403 del SuperadminGuard.
    const tenantRepo = dataSource.getRepository(Tenant);
    const tenant = await tenantRepo.save(
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
      passwordHash: await passwordService.hash('owner-password-1234'),
      firstName: 'Olga',
      lastName: 'Owner',
    });
  });

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
      expect(typeof body.accessToken).toBe('string');

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

    it('honra el override `x-rutinex-host` (equivale al host real)', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', 'localhost')
        .set('x-rutinex-host', 'superadmin.localhost')
        .send({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD })
        .expect(200);
    });

    it('401 con password incorrecta (mensaje genérico)', async () => {
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

    it('401 si el SUPERADMIN no existe', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', SUPERADMIN_HOST)
        .send({ email: 'nope@rutinex.app', password: 'x123456789012' })
        .expect(401);
    });

    it('400 si el body es inválido (DTO)', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', SUPERADMIN_HOST)
        .send({ email: 'no-email', password: '' })
        .expect(400);
    });
  });

  describe('POST /auth/login (host de tenant) con credenciales de SUPERADMIN', () => {
    it('401 genérico (no filtra existencia entre superficies)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD })
        .expect(401);

      expect(errBody(res)).toMatchObject({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('401 también con credenciales válidas de OWNER (Step 8 todavía no implementado)', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email: owner.email, password: 'owner-password-1234' })
        .expect(401);
    });
  });

  describe('GET /superadmin/ping (SuperadminGuard)', () => {
    const signFor = async (payload: {
      sub: string;
      tenantId: string | null;
      role: 'OWNER' | 'TRAINER' | 'STUDENT' | null;
      isSuperadmin: boolean;
    }): Promise<string> => jwtService.signAsync(payload);

    it('200 con JWT de SUPERADMIN obtenido vía /auth/login', async () => {
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
