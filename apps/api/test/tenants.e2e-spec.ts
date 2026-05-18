import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { Tenant } from './../src/modules/tenants/entities/tenant.entity';

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  code?: string;
  timestamp: string;
  path: string;
}

const errorBody = (res: request.Response): ErrorBody => res.body as ErrorBody;

/**
 * E2E del endpoint público `GET /tenants/by-slug/:slug`. El alta de tenants
 * se movió en Step 13 a `POST /superadmin/tenants` (cubierto por
 * `superadmin-tenants.e2e-spec.ts`). Acá sólo queda lo público para la
 * página del tenant.
 */
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
    await dataSource.query(
      'TRUNCATE TABLE "refresh_tokens", "users", "tenants" CASCADE',
    );
  });

  describe('GET /tenants/by-slug/:slug', () => {
    it('devuelve el tenant cuando existe', async () => {
      const tenantRepo = dataSource.getRepository(Tenant);
      const created = await tenantRepo.save(
        tenantRepo.create({
          slug: 'olimpo',
          name: 'Gimnasio Olimpo',
          branding: { primaryColor: '#FF5733' },
          isActive: true,
        }),
      );

      const res = await request(app.getHttpServer())
        .get('/tenants/by-slug/olimpo')
        .expect(200);

      expect(res.body).toEqual({
        id: created.id,
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
      const tenantRepo = dataSource.getRepository(Tenant);
      await tenantRepo.save(
        tenantRepo.create({
          slug: 'pausado',
          name: 'Pausado',
          branding: {},
          isActive: false,
        }),
      );

      await request(app.getHttpServer())
        .get('/tenants/by-slug/pausado')
        .expect(404);
    });
  });
});
