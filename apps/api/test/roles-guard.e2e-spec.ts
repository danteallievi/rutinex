import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from './../src/app.module';
import { PasswordService } from './../src/modules/auth/password.service';
import { Roles } from './../src/modules/auth/roles.decorator';
import { seedSuperadmin } from './../src/modules/auth/seed-superadmin';
import { SkipTenantGuard } from './../src/modules/auth/skip-tenant-guard.decorator';
import { Tenant } from './../src/modules/tenants/entities/tenant.entity';
import { User } from './../src/modules/users/entities/user.entity';
import { UsersService } from './../src/modules/users/users.service';

/**
 * Controller sintético usado únicamente en este spec para ejercitar el
 * `RolesGuard` global. No vive en `src/` porque Step 11 sólo agrega
 * guard + decorador — los CRUD que usan `@Roles` recién llegan en Step 12+.
 */
@Controller('test-roles-guard')
class RolesTestController {
  @Get('any')
  any(): { ok: true } {
    return { ok: true };
  }

  @Get('owner-only')
  @Roles('OWNER')
  ownerOnly(): { ok: true } {
    return { ok: true };
  }

  @Get('trainer-only')
  @Roles('TRAINER')
  trainerOnly(): { ok: true } {
    return { ok: true };
  }

  @Get('student-only')
  @Roles('STUDENT')
  studentOnly(): { ok: true } {
    return { ok: true };
  }

  @Get('staff')
  @Roles('OWNER', 'TRAINER')
  staffOnly(): { ok: true } {
    return { ok: true };
  }

  /**
   * Ruta sin TenantGuard para poder verificar que SUPERADMIN bypassa el
   * `RolesGuard` aunque la meta exija OWNER. En las rutas tenant-scoped
   * normales, el SUPERADMIN se choca antes con TENANT_MISMATCH (Step 10).
   */
  @Get('owner-only-cross-tenant')
  @SkipTenantGuard()
  @Roles('OWNER')
  ownerOnlyCrossTenant(): { ok: true } {
    return { ok: true };
  }
}

@Module({
  imports: [AppModule],
  controllers: [RolesTestController],
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
const TENANT_HOST = 'olimpo.rutinex.app';
const OWNER_PASSWORD = 'owner-password-1234';
const TRAINER_PASSWORD = 'trainer-password-1234';
const STUDENT_DNI = '12345678';

describe('RolesGuard (Step 11, e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersService: UsersService;
  let passwordService: PasswordService;

  let tenant: Tenant;
  let owner: User;
  let trainer: User;

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
      firstName: 'Ana',
      lastName: 'Owner',
    });
    trainer = await usersService.create({
      tenantId: tenant.id,
      role: 'TRAINER',
      email: 'trainer@olimpo.test',
      passwordHash: await passwordService.hash(TRAINER_PASSWORD),
      firstName: 'Beto',
      lastName: 'Trainer',
    });
    await usersService.create({
      tenantId: tenant.id,
      role: 'STUDENT',
      dni: STUDENT_DNI,
      firstName: 'Carla',
      lastName: 'Student',
    });
  });

  // helpers ---------------------------------------------------------------

  const loginAs = async (
    host: string,
    body: Record<string, string>,
    endpoint: '/auth/login' | '/auth/student-login' = '/auth/login',
  ): Promise<LoginBody> => {
    const res = await request(app.getHttpServer())
      .post(endpoint)
      .set('Host', host)
      .send(body)
      .expect(200);
    return loginBody(res);
  };

  const loginAsOwner = (): Promise<LoginBody> =>
    loginAs(TENANT_HOST, { email: owner.email!, password: OWNER_PASSWORD });

  const loginAsTrainer = (): Promise<LoginBody> =>
    loginAs(TENANT_HOST, {
      email: trainer.email!,
      password: TRAINER_PASSWORD,
    });

  const loginAsStudent = (): Promise<LoginBody> =>
    loginAs(TENANT_HOST, { dni: STUDENT_DNI }, '/auth/student-login');

  const loginAsSuperadmin = (): Promise<LoginBody> =>
    loginAs(SUPERADMIN_HOST, {
      email: SUPERADMIN_EMAIL,
      password: SUPERADMIN_PASSWORD,
    });

  // tests -----------------------------------------------------------------

  describe('endpoint sin @Roles → cualquier user autenticado pasa', () => {
    it('OWNER pasa', async () => {
      const { accessToken } = await loginAsOwner();
      await request(app.getHttpServer())
        .get('/test-roles-guard/any')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', tenant.slug)
        .expect(200);
    });

    it('STUDENT pasa', async () => {
      const { accessToken } = await loginAsStudent();
      await request(app.getHttpServer())
        .get('/test-roles-guard/any')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', tenant.slug)
        .expect(200);
    });

    it('sin Authorization → 401 (JwtAuthGuard global corre primero)', async () => {
      await request(app.getHttpServer())
        .get('/test-roles-guard/any')
        .expect(401);
    });
  });

  describe('@Roles("OWNER")', () => {
    it('OWNER pasa', async () => {
      const { accessToken } = await loginAsOwner();
      await request(app.getHttpServer())
        .get('/test-roles-guard/owner-only')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', tenant.slug)
        .expect(200);
    });

    it('TRAINER → 403 FORBIDDEN_ROLE', async () => {
      const { accessToken } = await loginAsTrainer();
      const res = await request(app.getHttpServer())
        .get('/test-roles-guard/owner-only')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', tenant.slug)
        .expect(403);
      expect(errBody(res)).toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN_ROLE',
      });
    });

    it('STUDENT → 403 FORBIDDEN_ROLE', async () => {
      const { accessToken } = await loginAsStudent();
      const res = await request(app.getHttpServer())
        .get('/test-roles-guard/owner-only')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', tenant.slug)
        .expect(403);
      expect(errBody(res)).toMatchObject({ code: 'FORBIDDEN_ROLE' });
    });
  });

  describe('@Roles("TRAINER")', () => {
    it('TRAINER pasa', async () => {
      const { accessToken } = await loginAsTrainer();
      await request(app.getHttpServer())
        .get('/test-roles-guard/trainer-only')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', tenant.slug)
        .expect(200);
    });

    it('OWNER → 403 FORBIDDEN_ROLE', async () => {
      const { accessToken } = await loginAsOwner();
      await request(app.getHttpServer())
        .get('/test-roles-guard/trainer-only')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', tenant.slug)
        .expect(403);
    });
  });

  describe('@Roles("STUDENT")', () => {
    it('STUDENT pasa', async () => {
      const { accessToken } = await loginAsStudent();
      await request(app.getHttpServer())
        .get('/test-roles-guard/student-only')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', tenant.slug)
        .expect(200);
    });

    it('TRAINER → 403 FORBIDDEN_ROLE', async () => {
      const { accessToken } = await loginAsTrainer();
      await request(app.getHttpServer())
        .get('/test-roles-guard/student-only')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', tenant.slug)
        .expect(403);
    });
  });

  describe('@Roles("OWNER", "TRAINER") (staff)', () => {
    it('OWNER pasa', async () => {
      const { accessToken } = await loginAsOwner();
      await request(app.getHttpServer())
        .get('/test-roles-guard/staff')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', tenant.slug)
        .expect(200);
    });

    it('TRAINER pasa', async () => {
      const { accessToken } = await loginAsTrainer();
      await request(app.getHttpServer())
        .get('/test-roles-guard/staff')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', tenant.slug)
        .expect(200);
    });

    it('STUDENT → 403 FORBIDDEN_ROLE', async () => {
      const { accessToken } = await loginAsStudent();
      await request(app.getHttpServer())
        .get('/test-roles-guard/staff')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', tenant.slug)
        .expect(403);
    });
  });

  describe('SUPERADMIN', () => {
    it('en ruta tenant-scoped con @Roles → 403 TENANT_MISMATCH (TenantGuard corre antes)', async () => {
      const { accessToken } = await loginAsSuperadmin();
      const res = await request(app.getHttpServer())
        .get('/test-roles-guard/owner-only')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-tenant-slug', tenant.slug)
        .expect(403);
      // El TenantGuard rechaza antes de que RolesGuard llegue a evaluar.
      expect(errBody(res)).toMatchObject({ code: 'TENANT_MISMATCH' });
    });

    it('en ruta @SkipTenantGuard con @Roles("OWNER") → bypassa por isSuperadmin (ADR-019)', async () => {
      const { accessToken } = await loginAsSuperadmin();
      await request(app.getHttpServer())
        .get('/test-roles-guard/owner-only-cross-tenant')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });
});
