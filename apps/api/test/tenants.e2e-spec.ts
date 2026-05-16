import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';

interface TenantBody {
  id: string;
  slug: string;
  name: string;
  branding: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  code?: string;
  timestamp: string;
  path: string;
}

const tenantBody = (res: request.Response): TenantBody =>
  res.body as TenantBody;
const errorBody = (res: request.Response): ErrorBody => res.body as ErrorBody;

describe('TenantsController (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE "tenants" CASCADE');
  });

  describe('POST /tenants', () => {
    it('crea un tenant con payload mínimo', async () => {
      const res = await request(app.getHttpServer())
        .post('/tenants')
        .send({ slug: 'olimpo', name: 'Gimnasio Olimpo' })
        .expect(201);

      const body = tenantBody(res);
      expect(body).toMatchObject({
        slug: 'olimpo',
        name: 'Gimnasio Olimpo',
        branding: {},
        isActive: true,
      });
      expect(body.id).toEqual(expect.any(String));
      expect(body.createdAt).toEqual(expect.any(String));
    });

    it('acepta branding y descarta propiedades no whitelisteadas', async () => {
      const res = await request(app.getHttpServer())
        .post('/tenants')
        .send({
          slug: 'fit-club',
          name: 'Fit Club',
          branding: { primaryColor: '#FF5733' },
        })
        .expect(201);

      expect(tenantBody(res).branding).toEqual({ primaryColor: '#FF5733' });
    });

    it('rechaza con 409 si el slug es reservado', async () => {
      const res = await request(app.getHttpServer())
        .post('/tenants')
        .send({ slug: 'admin', name: 'Admin Gym' })
        .expect(409);

      const body = errorBody(res);
      expect(body).toMatchObject({
        statusCode: 409,
        code: 'SLUG_RESERVED',
      });
      expect(body.timestamp).toEqual(expect.any(String));
      expect(body.path).toBe('/tenants');
    });

    it('rechaza con 409 si el slug ya existe', async () => {
      await request(app.getHttpServer())
        .post('/tenants')
        .send({ slug: 'olimpo', name: 'Gimnasio Olimpo' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/tenants')
        .send({ slug: 'olimpo', name: 'Otro' })
        .expect(409);

      expect(errorBody(res)).toMatchObject({
        statusCode: 409,
        code: 'SLUG_TAKEN',
      });
    });

    it('rechaza con 400 si el slug no matchea el regex', async () => {
      await request(app.getHttpServer())
        .post('/tenants')
        .send({ slug: 'NoMayus', name: 'Mal' })
        .expect(400);
    });

    it('rechaza con 400 si el slug es muy corto', async () => {
      await request(app.getHttpServer())
        .post('/tenants')
        .send({ slug: 'ab', name: 'Mal' })
        .expect(400);
    });

    it('rechaza con 400 si faltan campos requeridos', async () => {
      await request(app.getHttpServer())
        .post('/tenants')
        .send({ slug: 'valid-slug' })
        .expect(400);
    });

    it('rechaza con 400 si llegan propiedades no permitidas', async () => {
      await request(app.getHttpServer())
        .post('/tenants')
        .send({
          slug: 'valid-slug',
          name: 'OK',
          isActive: false,
        })
        .expect(400);
    });
  });

  describe('GET /tenants/by-slug/:slug', () => {
    it('devuelve el tenant cuando existe', async () => {
      const created = await request(app.getHttpServer())
        .post('/tenants')
        .send({
          slug: 'olimpo',
          name: 'Gimnasio Olimpo',
          branding: { primaryColor: '#FF5733' },
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/tenants/by-slug/olimpo')
        .expect(200);

      expect(res.body).toEqual({
        id: tenantBody(created).id,
        slug: 'olimpo',
        name: 'Gimnasio Olimpo',
        branding: { primaryColor: '#FF5733' },
      });
    });

    it('devuelve 404 cuando el slug no existe', async () => {
      const res = await request(app.getHttpServer())
        .get('/tenants/by-slug/inexistente')
        .expect(404);

      expect(errorBody(res)).toMatchObject({
        statusCode: 404,
        code: 'TENANT_NOT_FOUND',
      });
    });

    it('devuelve 404 cuando el tenant está desactivado (no filtra existencia)', async () => {
      await request(app.getHttpServer())
        .post('/tenants')
        .send({ slug: 'pausado', name: 'Pausado' })
        .expect(201);

      await dataSource.query(
        `UPDATE "tenants" SET "is_active" = false WHERE "slug" = $1`,
        ['pausado'],
      );

      await request(app.getHttpServer())
        .get('/tenants/by-slug/pausado')
        .expect(404);
    });
  });
});
