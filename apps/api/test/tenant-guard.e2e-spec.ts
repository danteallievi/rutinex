import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { PasswordService } from './../src/modules/auth/password.service';
import { seedSuperadmin } from './../src/modules/auth/seed-superadmin';
import { TenantId } from './../src/modules/auth/tenant-id.decorator';
import { Tenant } from './../src/modules/tenants/entities/tenant.entity';
import { User } from './../src/modules/users/entities/user.entity';
import { UsersService } from './../src/modules/users/users.service';

/**
 * Controller sintético usado únicamente en este spec para ejercitar el
 * `TenantGuard` global. No vive en `src/` porque Step 10 no agrega
 * endpoints reales — sólo guards + refactor. Los endpoints CRUD de
 * verdad llegan en Step 12 (users) y Step 13 (superadmin).
 */
@Controller('test-tenant-guard')
class TenantScopedTestController {
  @Get('me')
  me(@TenantId() tenantId: string): { tenantId: string } {
    return { tenantId };
  }
}

@Module({
  imports: [AppModule],
  controllers: [TenantScopedTestController],
})
class TestAppModule {}

interface LoginBody {
  accessToken: string;
  user: {
    id: string;
    role: 'OWNER' | 'TRAINER' | 'STUDENT' | null;
    tenant: { id: string; slug: string } | null;
  };
}

interface ErrorBody {
  statusCode: number;
  code?: string;
  message?: string | string[];
}

const loginBody = (res: request.Response): LoginBody => res.body as LoginBody;
const errBody = (res: request.Response): ErrorBody => res.body as ErrorBody;

const SUPERADMIN_EMAIL = 'super@rutinex.app';
const SUPERADMIN_PASSWORD = 'una-password-segura-larga';
const SUPERADMIN_HOST = 'superadmin.rutinex.app';
const TENANT_A_HOST = 'olimpo.rutinex.app';
const TENANT_B_HOST = 'rival.rutinex.app';
const OWNER_A_PASSWORD = 'owner-a-password-1234';
const OWNER_B_PASSWORD = 'owner-b-password-1234';

describe('TenantGuard + cross-tenant (Step 10, e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersService: UsersService;
  let passwordService: PasswordService;

  let tenantA: Tenant;
  let tenantB: Tenant;
  let ownerA: User;
  let ownerB: User;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
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
        slug: 'olimpo',
        name: 'Gimnasio Olimpo',
        branding: {},
        isActive: true,
      }),
    );
    tenantB = await tenantRepo.save(
      tenantRepo.create({
        slug: 'rival',
        name: 'Gimnasio Rival',
        branding: {},
        isActive: true,
      }),
    );

    ownerA = await usersService.create({
      tenantId: tenantA.id,
      role: 'OWNER',
      email: 'owner@olimpo.test',
      passwordHash: await passwordService.hash(OWNER_A_PASSWORD),
      firstName: 'Ana',
      lastName: 'Owner-A',
    });
    ownerB = await usersService.create({
      tenantId: tenantB.id,
      role: 'OWNER',
      email: 'owner@rival.test',
      passwordHash: await passwordService.hash(OWNER_B_PASSWORD),
      firstName: 'Bea',
      lastName: 'Owner-B',
    });
  });

  // helpers ---------------------------------------------------------------

  const loginAsOwnerA = async (): Promise<LoginBody> => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Host', TENANT_A_HOST)
      .send({ email: ownerA.email, password: OWNER_A_PASSWORD })
      .expect(200);
    return loginBody(res);
  };

  const loginAsOwnerB = async (): Promise<LoginBody> => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Host', TENANT_B_HOST)
      .send({ email: ownerB.email, password: OWNER_B_PASSWORD })
      .expect(200);
    return loginBody(res);
  };

  const loginAsSuperadmin = async (): Promise<LoginBody> => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Host', SUPERADMIN_HOST)
      .send({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD })
      .expect(200);
    return loginBody(res);
  };

  // tests -----------------------------------------------------------------

  describe('endpoint tenant-scoped (sintético)', () => {
    it('401 sin Authorization (JwtAuthGuard global corre primero)', async () => {
      await request(app.getHttpServer())
        .get('/test-tenant-guard/me')
        .expect(401);
    });

    it('400 TENANT_SLUG_REQUIRED si no llega x-tenant-slug', async () => {
      const { accessToken } = await loginAsOwnerA();
      const res = await request(app.getHttpServer())
        .get('/test-tenant-guard/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
      expect(errBody(res)).toMatchObject({
        statusCode: 400,
        code: 'TENANT_SLUG_REQUIRED',
      });
    });

    it('200 cuando OWNER de A pega con x-tenant-slug de A', async () => {
      const { accessToken } = await loginAsOwnerA();
      const res = await request(app.getHttpServer())
        .get('/test-tenant-guard/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', tenantA.slug)
        .expect(200);
      expect(res.body).toEqual({ tenantId: tenantA.id });
    });

    it('403 TENANT_MISMATCH cuando OWNER de A pega con x-tenant-slug de B', async () => {
      const { accessToken } = await loginAsOwnerA();
      const res = await request(app.getHttpServer())
        .get('/test-tenant-guard/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', tenantB.slug)
        .expect(403);
      expect(errBody(res)).toMatchObject({
        statusCode: 403,
        code: 'TENANT_MISMATCH',
      });
    });

    it('403 TENANT_MISMATCH cuando el slug no existe (no se filtra existencia)', async () => {
      const { accessToken } = await loginAsOwnerA();
      const res = await request(app.getHttpServer())
        .get('/test-tenant-guard/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', 'no-existe')
        .expect(403);
      expect(errBody(res)).toMatchObject({ code: 'TENANT_MISMATCH' });
    });

    it('403 TENANT_INACTIVE cuando el tenant matchea pero está pausado', async () => {
      const { accessToken } = await loginAsOwnerA();
      // El login se hizo antes de pausar; ahora pausamos.
      await dataSource
        .getRepository(Tenant)
        .update({ id: tenantA.id }, { isActive: false });

      const res = await request(app.getHttpServer())
        .get('/test-tenant-guard/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', tenantA.slug)
        .expect(403);
      expect(errBody(res)).toMatchObject({ code: 'TENANT_INACTIVE' });
    });

    it('SUPERADMIN tocando un endpoint tenant-scoped → 403 TENANT_MISMATCH', async () => {
      const { accessToken } = await loginAsSuperadmin();
      const res = await request(app.getHttpServer())
        .get('/test-tenant-guard/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', tenantA.slug)
        .expect(403);
      expect(errBody(res)).toMatchObject({ code: 'TENANT_MISMATCH' });
    });

    it('@TenantId() inyecta el tenantId del JWT (no del header) — verificado en el body', async () => {
      const { accessToken } = await loginAsOwnerB();
      const res = await request(app.getHttpServer())
        .get('/test-tenant-guard/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', tenantB.slug)
        .expect(200);
      expect(res.body).toEqual({ tenantId: tenantB.id });
    });
  });

  describe('skip rules (no toca el TenantGuard)', () => {
    it('SUPERADMIN puede hitear /superadmin/* sin x-tenant-slug', async () => {
      const { accessToken } = await loginAsSuperadmin();
      await request(app.getHttpServer())
        .get('/superadmin/ping')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('/auth/change-password (no @Public, @SkipTenantGuard) no exige x-tenant-slug', async () => {
      const { accessToken } = await loginAsOwnerA();
      // Modo voluntario sin currentPassword → 400 CURRENT_PASSWORD_REQUIRED.
      // El punto: NO es 400 TENANT_SLUG_REQUIRED ni 401 — el TenantGuard
      // se skipea por el decorator a nivel controller.
      const res = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newPassword: 'nueva-password-1234' })
        .expect(400);
      expect(errBody(res)).toMatchObject({ code: 'CURRENT_PASSWORD_REQUIRED' });
    });

    it('GET /tenants/by-slug (@Public) no exige nada', async () => {
      await request(app.getHttpServer())
        .get(`/tenants/by-slug/${tenantA.slug}`)
        .expect(200);
    });

    it('healthcheck @Public en / no exige nada', async () => {
      await request(app.getHttpServer()).get('/').expect(200);
    });
  });
});
