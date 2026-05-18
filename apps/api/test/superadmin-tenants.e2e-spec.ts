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
    tenant: { id: string; slug: string; name: string } | null;
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

interface SuperadminTenantBody {
  id: string;
  slug: string;
  name: string;
  branding: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateTenantBody {
  tenant: SuperadminTenantBody;
  owner: UserResponseBody;
  ownerPassword: string;
}

interface PaginatedTenantsBody {
  data: SuperadminTenantBody[];
  page: number;
  pageSize: number;
  total: number;
}

interface ResetOwnerBody {
  owner: UserResponseBody;
  ownerPassword: string;
}

interface ErrorBody {
  statusCode: number;
  code?: string;
  message?: string | string[];
}

const SUPERADMIN_EMAIL = 'super@rutinex.app';
const SUPERADMIN_PASSWORD = 'una-password-segura-larga';
const SUPERADMIN_HOST = 'superadmin.rutinex.app';
const TENANT_HOST = 'olimpo.rutinex.app';
const OWNER_EMAIL = 'owner@olimpo.test';
const OWNER_FIRST = 'Olga';
const OWNER_LAST = 'Owner';
const OTHER_OWNER_PASSWORD = 'otra-owner-pass-1234';

describe('Superadmin Tenants — Step 13 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usersService: UsersService;
  let passwordService: PasswordService;

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
  });

  // helpers -------------------------------------------------------------------
  const loginSuperadmin = async (): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Host', SUPERADMIN_HOST)
      .send({ email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD })
      .expect(200);
    return (res.body as LoginResponseBody).accessToken;
  };

  const createTenant = async (
    bearer: string,
    overrides: Partial<{
      slug: string;
      name: string;
      branding: Record<string, string>;
      owner: { email: string; firstName: string; lastName: string };
    }> = {},
  ): Promise<CreateTenantBody> => {
    const body = {
      slug: overrides.slug ?? 'olimpo',
      name: overrides.name ?? 'Gimnasio Olimpo',
      branding: overrides.branding,
      owner: overrides.owner ?? {
        email: OWNER_EMAIL,
        firstName: OWNER_FIRST,
        lastName: OWNER_LAST,
      },
    };
    const res = await request(app.getHttpServer())
      .post('/superadmin/tenants')
      .set('Authorization', `Bearer ${bearer}`)
      .send(body)
      .expect(201);
    return res.body as CreateTenantBody;
  };

  // --------------------------------------------------------------------------
  // POST /superadmin/tenants
  // --------------------------------------------------------------------------
  describe('POST /superadmin/tenants', () => {
    it('401 sin Authorization', async () => {
      await request(app.getHttpServer())
        .post('/superadmin/tenants')
        .send({
          slug: 'olimpo',
          name: 'Gimnasio Olimpo',
          owner: {
            email: OWNER_EMAIL,
            firstName: OWNER_FIRST,
            lastName: OWNER_LAST,
          },
        })
        .expect(401);
    });

    it('403 NOT_SUPERADMIN con JWT de OWNER', async () => {
      // Creamos tenant+OWNER vía service (sin pasar por el endpoint).
      const tenantRepo = dataSource.getRepository(Tenant);
      const t = await tenantRepo.save(
        tenantRepo.create({
          slug: 'preexistente',
          name: 'Pre',
          branding: {},
          isActive: true,
        }),
      );
      await usersService.create({
        tenantId: t.id,
        role: 'OWNER',
        email: 'pre-owner@pre.test',
        passwordHash: await passwordService.hash(OTHER_OWNER_PASSWORD),
        firstName: 'Pre',
        lastName: 'Owner',
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', 'preexistente.rutinex.app')
        .send({ email: 'pre-owner@pre.test', password: OTHER_OWNER_PASSWORD })
        .expect(200);
      const ownerToken = (loginRes.body as LoginResponseBody).accessToken;

      const res = await request(app.getHttpServer())
        .post('/superadmin/tenants')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          slug: 'nuevo',
          name: 'Nuevo',
          owner: {
            email: 'x@x.test',
            firstName: 'X',
            lastName: 'Y',
          },
        })
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('NOT_SUPERADMIN');
    });

    it('crea tenant + OWNER OK, devuelve la pass una vez, OWNER puede loguearse + mustChangePassword=true', async () => {
      const token = await loginSuperadmin();
      const body = await createTenant(token);

      expect(body.tenant.slug).toBe('olimpo');
      expect(body.tenant.isActive).toBe(true);
      expect(body.owner.role).toBe('OWNER');
      expect(body.owner.email).toBe(OWNER_EMAIL);
      expect(body.owner.mustChangePassword).toBe(true);
      expect(typeof body.ownerPassword).toBe('string');
      expect(body.ownerPassword.length).toBe(16);

      // El OWNER puede loguearse desde <slug>.rutinex.app con esa pass.
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email: OWNER_EMAIL, password: body.ownerPassword })
        .expect(200);
      const login = loginRes.body as LoginResponseBody;
      expect(login.user.role).toBe('OWNER');
      expect(login.user.mustChangePassword).toBe(true);
      expect(login.user.tenant?.id).toBe(body.tenant.id);

      // Tras change-password, mustChangePassword=false.
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${login.accessToken}`)
        .send({ newPassword: 'mi-password-larga-1234' })
        .expect(204);

      const reLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email: OWNER_EMAIL, password: 'mi-password-larga-1234' })
        .expect(200);
      expect((reLogin.body as LoginResponseBody).user.mustChangePassword).toBe(
        false,
      );
    });

    it('aplica branding', async () => {
      const token = await loginSuperadmin();
      const body = await createTenant(token, {
        branding: { primaryColor: '#FF0000' },
      });
      expect(body.tenant.branding).toEqual({ primaryColor: '#FF0000' });
    });

    it('409 SLUG_RESERVED', async () => {
      const token = await loginSuperadmin();
      const res = await request(app.getHttpServer())
        .post('/superadmin/tenants')
        .set('Authorization', `Bearer ${token}`)
        .send({
          slug: 'admin',
          name: 'Admin',
          owner: {
            email: OWNER_EMAIL,
            firstName: OWNER_FIRST,
            lastName: OWNER_LAST,
          },
        })
        .expect(409);
      expect((res.body as ErrorBody).code).toBe('SLUG_RESERVED');
    });

    it('409 SLUG_TAKEN si el slug ya existe', async () => {
      const token = await loginSuperadmin();
      await createTenant(token);

      const res = await request(app.getHttpServer())
        .post('/superadmin/tenants')
        .set('Authorization', `Bearer ${token}`)
        .send({
          slug: 'olimpo',
          name: 'Otra',
          owner: {
            email: 'otro@otro.test',
            firstName: 'X',
            lastName: 'Y',
          },
        })
        .expect(409);
      expect((res.body as ErrorBody).code).toBe('SLUG_TAKEN');
    });

    it('400 con body inválido (sin owner)', async () => {
      const token = await loginSuperadmin();
      await request(app.getHttpServer())
        .post('/superadmin/tenants')
        .set('Authorization', `Bearer ${token}`)
        .send({ slug: 'olimpo', name: 'Gym' })
        .expect(400);
    });

    it('400 con slug inválido (regex)', async () => {
      const token = await loginSuperadmin();
      await request(app.getHttpServer())
        .post('/superadmin/tenants')
        .set('Authorization', `Bearer ${token}`)
        .send({
          slug: 'MaYus',
          name: 'X',
          owner: {
            email: OWNER_EMAIL,
            firstName: OWNER_FIRST,
            lastName: OWNER_LAST,
          },
        })
        .expect(400);
    });

    it('rollback: si falla la creación del OWNER (email inválido), no queda el tenant huérfano', async () => {
      const token = await loginSuperadmin();
      await request(app.getHttpServer())
        .post('/superadmin/tenants')
        .set('Authorization', `Bearer ${token}`)
        .send({
          slug: 'olimpo',
          name: 'Gym',
          owner: {
            email: 'no-es-email',
            firstName: OWNER_FIRST,
            lastName: OWNER_LAST,
          },
        })
        .expect(400);

      const tenants = await dataSource.getRepository(Tenant).find();
      expect(tenants.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // GET /superadmin/tenants
  // --------------------------------------------------------------------------
  describe('GET /superadmin/tenants', () => {
    it('lista todos los tenants (default active=all)', async () => {
      const token = await loginSuperadmin();
      await createTenant(token);
      await createTenant(token, {
        slug: 'spartan',
        name: 'Spartan',
        owner: {
          email: 'owner@spartan.test',
          firstName: 'S',
          lastName: 'Owner',
        },
      });
      // Uno pausado.
      await createTenant(token, {
        slug: 'pausado',
        name: 'Pausado',
        owner: {
          email: 'owner@pausado.test',
          firstName: 'P',
          lastName: 'Owner',
        },
      });
      await dataSource
        .getRepository(Tenant)
        .update({ slug: 'pausado' }, { isActive: false });

      const res = await request(app.getHttpServer())
        .get('/superadmin/tenants')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const body = res.body as PaginatedTenantsBody;
      expect(body.total).toBe(3);
      expect(body.data.length).toBe(3);
    });

    it('filtro active=true', async () => {
      const token = await loginSuperadmin();
      await createTenant(token);
      await createTenant(token, {
        slug: 'pausado',
        name: 'Pausado',
        owner: {
          email: 'owner@pausado.test',
          firstName: 'P',
          lastName: 'Owner',
        },
      });
      await dataSource
        .getRepository(Tenant)
        .update({ slug: 'pausado' }, { isActive: false });

      const res = await request(app.getHttpServer())
        .get('/superadmin/tenants?active=true')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const body = res.body as PaginatedTenantsBody;
      expect(body.total).toBe(1);
      expect(body.data[0]!.slug).toBe('olimpo');
    });

    it('filtro active=false', async () => {
      const token = await loginSuperadmin();
      await createTenant(token);
      await createTenant(token, {
        slug: 'pausado',
        name: 'Pausado',
        owner: {
          email: 'owner@pausado.test',
          firstName: 'P',
          lastName: 'Owner',
        },
      });
      await dataSource
        .getRepository(Tenant)
        .update({ slug: 'pausado' }, { isActive: false });

      const res = await request(app.getHttpServer())
        .get('/superadmin/tenants?active=false')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const body = res.body as PaginatedTenantsBody;
      expect(body.total).toBe(1);
      expect(body.data[0]!.slug).toBe('pausado');
    });

    it('paginación page=1 pageSize=1', async () => {
      const token = await loginSuperadmin();
      await createTenant(token);
      await createTenant(token, {
        slug: 'spartan',
        name: 'Spartan',
        owner: {
          email: 'owner@spartan.test',
          firstName: 'S',
          lastName: 'Owner',
        },
      });
      const res = await request(app.getHttpServer())
        .get('/superadmin/tenants?page=1&pageSize=1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const body = res.body as PaginatedTenantsBody;
      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(1);
      expect(body.total).toBe(2);
      expect(body.data.length).toBe(1);
    });

    it('401 sin Authorization', async () => {
      await request(app.getHttpServer()).get('/superadmin/tenants').expect(401);
    });
  });

  // --------------------------------------------------------------------------
  // PATCH /superadmin/tenants/:id
  // --------------------------------------------------------------------------
  describe('PATCH /superadmin/tenants/:id', () => {
    it('toggle isActive=false revoca refresh tokens del tenant + bloquea login', async () => {
      const token = await loginSuperadmin();
      const created = await createTenant(token);

      // El OWNER tiene una sesión viva.
      const ownerLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email: OWNER_EMAIL, password: created.ownerPassword })
        .expect(200);
      const owner = ownerLogin.body as LoginResponseBody;

      // Pausamos el tenant.
      const patchRes = await request(app.getHttpServer())
        .patch(`/superadmin/tenants/${created.tenant.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false })
        .expect(200);
      expect((patchRes.body as SuperadminTenantBody).isActive).toBe(false);

      // El refresh del OWNER deja de servir.
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: owner.refreshToken })
        .expect(401);

      // Y el login devuelve 403 TENANT_INACTIVE.
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email: OWNER_EMAIL, password: created.ownerPassword })
        .expect(403);
      expect((loginRes.body as ErrorBody).code).toBe('TENANT_INACTIVE');

      // Verificación directa de la DB: refresh row revocado.
      const rows = await dataSource
        .getRepository(RefreshToken)
        .find({ where: { userId: owner.user.id } });
      expect(rows.every((r) => r.revokedAt !== null)).toBe(true);
    });

    it('edita branding sin tocar isActive', async () => {
      const token = await loginSuperadmin();
      const created = await createTenant(token);
      const res = await request(app.getHttpServer())
        .patch(`/superadmin/tenants/${created.tenant.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ branding: { primaryColor: '#0000FF' } })
        .expect(200);
      const body = res.body as SuperadminTenantBody;
      expect(body.branding).toEqual({ primaryColor: '#0000FF' });
      expect(body.isActive).toBe(true);
    });

    it('reactiva un tenant pausado (isActive=true) sin tocar refresh tokens', async () => {
      const token = await loginSuperadmin();
      const created = await createTenant(token);
      await dataSource
        .getRepository(Tenant)
        .update({ id: created.tenant.id }, { isActive: false });

      const res = await request(app.getHttpServer())
        .patch(`/superadmin/tenants/${created.tenant.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: true })
        .expect(200);
      expect((res.body as SuperadminTenantBody).isActive).toBe(true);
    });

    it('404 TENANT_NOT_FOUND si el id no existe', async () => {
      const token = await loginSuperadmin();
      const res = await request(app.getHttpServer())
        .patch('/superadmin/tenants/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false })
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('TENANT_NOT_FOUND');
    });

    it('400 si el id no es UUID (ParseUUIDPipe)', async () => {
      const token = await loginSuperadmin();
      await request(app.getHttpServer())
        .patch('/superadmin/tenants/no-uuid')
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false })
        .expect(400);
    });
  });

  // --------------------------------------------------------------------------
  // POST /superadmin/tenants/:id/reset-owner-password
  // --------------------------------------------------------------------------
  describe('POST /superadmin/tenants/:id/reset-owner-password', () => {
    it('resetea OWNER: la vieja deja de servir, la nueva sí, mustChangePassword=true, refresh revocados', async () => {
      const token = await loginSuperadmin();
      const created = await createTenant(token);
      const oldPass = created.ownerPassword;

      // OWNER ya cambió su password una vez, así operamos sobre un caso
      // realista (con mustChangePassword=false antes del reset).
      const firstLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email: OWNER_EMAIL, password: oldPass })
        .expect(200);
      const first = firstLogin.body as LoginResponseBody;
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${first.accessToken}`)
        .send({ newPassword: 'la-elegida-1234' })
        .expect(204);

      // Una nueva sesión post change-password.
      const secondLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email: OWNER_EMAIL, password: 'la-elegida-1234' })
        .expect(200);
      const second = secondLogin.body as LoginResponseBody;
      expect(second.user.mustChangePassword).toBe(false);

      // SUPERADMIN resetea.
      const resetRes = await request(app.getHttpServer())
        .post(`/superadmin/tenants/${created.tenant.id}/reset-owner-password`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const reset = resetRes.body as ResetOwnerBody;
      expect(typeof reset.ownerPassword).toBe('string');
      expect(reset.ownerPassword.length).toBe(16);
      expect(reset.owner.id).toBe(second.user.id);
      expect(reset.owner.mustChangePassword).toBe(true);

      // La password elegida deja de servir.
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email: OWNER_EMAIL, password: 'la-elegida-1234' })
        .expect(401);

      // La nueva sí + mustChangePassword=true.
      const reLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email: OWNER_EMAIL, password: reset.ownerPassword })
        .expect(200);
      expect((reLogin.body as LoginResponseBody).user.mustChangePassword).toBe(
        true,
      );

      // Refresh del OWNER (sesión "second") fue revocado.
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: second.refreshToken })
        .expect(401);
    });

    it('sin ownerId: elige el primero por createdAt ASC cuando hay >1 OWNER', async () => {
      const token = await loginSuperadmin();
      const created = await createTenant(token);

      // Insertamos un segundo OWNER con createdAt posterior.
      const second = await usersService.create({
        tenantId: created.tenant.id,
        role: 'OWNER',
        email: 'owner2@olimpo.test',
        passwordHash: await passwordService.hash(OTHER_OWNER_PASSWORD),
        firstName: 'Segundo',
        lastName: 'Owner',
      });
      // Aseguramos que el segundo tenga createdAt posterior al primero.
      await dataSource
        .getRepository(User)
        .update(
          { id: second.id },
          { createdAt: new Date(Date.now() + 60_000) },
        );

      const res = await request(app.getHttpServer())
        .post(`/superadmin/tenants/${created.tenant.id}/reset-owner-password`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const body = res.body as ResetOwnerBody;
      // El reset cae sobre el primer OWNER (el creado vía createTenant).
      expect(body.owner.id).toBe(created.owner.id);
    });

    it('con ?ownerId apunta al OWNER específico', async () => {
      const token = await loginSuperadmin();
      const created = await createTenant(token);

      const second = await usersService.create({
        tenantId: created.tenant.id,
        role: 'OWNER',
        email: 'owner2@olimpo.test',
        passwordHash: await passwordService.hash(OTHER_OWNER_PASSWORD),
        firstName: 'Segundo',
        lastName: 'Owner',
      });

      const res = await request(app.getHttpServer())
        .post(
          `/superadmin/tenants/${created.tenant.id}/reset-owner-password?ownerId=${second.id}`,
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((res.body as ResetOwnerBody).owner.id).toBe(second.id);
    });

    it('404 OWNER_NOT_FOUND si el tenant no tiene OWNER', async () => {
      const token = await loginSuperadmin();
      const tenantRepo = dataSource.getRepository(Tenant);
      const huerfano = await tenantRepo.save(
        tenantRepo.create({
          slug: 'sin-owner',
          name: 'Sin OWNER',
          branding: {},
          isActive: true,
        }),
      );

      const res = await request(app.getHttpServer())
        .post(`/superadmin/tenants/${huerfano.id}/reset-owner-password`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('OWNER_NOT_FOUND');
    });

    it('404 OWNER_NOT_FOUND si ?ownerId no es OWNER del tenant', async () => {
      const token = await loginSuperadmin();
      const created = await createTenant(token);

      const res = await request(app.getHttpServer())
        .post(
          `/superadmin/tenants/${created.tenant.id}/reset-owner-password?ownerId=00000000-0000-0000-0000-000000000000`,
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('OWNER_NOT_FOUND');
    });

    it('404 TENANT_NOT_FOUND si el tenant no existe', async () => {
      const token = await loginSuperadmin();
      const res = await request(app.getHttpServer())
        .post(
          '/superadmin/tenants/00000000-0000-0000-0000-000000000000/reset-owner-password',
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      expect((res.body as ErrorBody).code).toBe('TENANT_NOT_FOUND');
    });

    it('403 NOT_SUPERADMIN con JWT de OWNER', async () => {
      const token = await loginSuperadmin();
      const created = await createTenant(token);

      const ownerLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Host', TENANT_HOST)
        .send({ email: OWNER_EMAIL, password: created.ownerPassword })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/superadmin/tenants/${created.tenant.id}/reset-owner-password`)
        .set(
          'Authorization',
          `Bearer ${(ownerLogin.body as LoginResponseBody).accessToken}`,
        )
        .expect(403);
      expect((res.body as ErrorBody).code).toBe('NOT_SUPERADMIN');
    });
  });
});
