# 09 — Progreso

Estado actual del proyecto. Este archivo lo mantiene Claude Code (y vos) actualizado paso a paso. Es lo primero que se lee al retomar.

## Estado general

**Fase actual**: Fase 1 — Backend foundations.
**Paso actual**: Step 4 completo. Próximo: Step 5 — Entity User + módulo Users.
**Última actualización**: 2026-05-16 — Step 4 (módulo Tenants + resolución por slug) completado.

## Pasos completados

### Step 1 — Monorepo skeleton (2026-05-13)

Monorepo pnpm workspaces con `apps/api` (NestJS 11), `apps/web` (Next 15.5.18 + React 19.1 + Tailwind 4 + App Router) y `packages/shared-types` (vacío, listo para tipos compartidos). `pnpm install` corre limpio en la raíz; `pnpm api:dev` levanta `GET / → "Hello World!"`; `pnpm web:dev` levanta la página default de Next.
Archivos clave: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `.nvmrc`, `.npmrc`, `apps/api/*`, `apps/web/*`, `packages/shared-types/*`.
Notas:

- Se ignoró Next 16 (recién salido) y se fijó Next 15 para mantener ADR-006/009 y el roadmap pensado para Next 15.
- Tsconfigs de api y web ya tienen `strict: true` y `noUncheckedIndexedAccess: true`.
- `next.config.ts` fija `turbopack.root` al root del monorepo para evitar el warning de lockfiles ambiguos.
- `pnpm.onlyBuiltDependencies` en el root permite los install scripts de `sharp`, `unrs-resolver`, `@swc/core`, `@nestjs/core`, `@tailwindcss/oxide`, `esbuild` (los que pnpm 10 bloquea por default).
- Las docs estaban sueltas en el root: se movieron a `docs/` para alinear con los crosslinks del `CLAUDE.md`.

### Step 2 — Linting, formatting, hooks (2026-05-14)

ESLint flat config único en `eslint.config.mjs` (raíz) compartido por `apps/api` y `apps/web`. Prettier config raíz (`.prettierrc` + `.prettierignore`). `husky` v9 con `.husky/pre-commit` que corre `pnpm exec lint-staged`. Configuración de lint-staged en `.lintstagedrc.json`: eslint --fix + prettier --write para TS/JS, prettier para JSON/MD/CSS/YAML.

Scripts raíz: `pnpm lint` (`eslint .`), `pnpm lint:fix`, `pnpm format` (`prettier --write .`), `pnpm format:check`, `pnpm prepare` (husky). `pnpm lint` corre con 0 errors y 0 warnings; `pnpm format:check` confirma que todos los archivos están en estilo.

Archivos clave: `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `.lintstagedrc.json`, `.husky/pre-commit`, scripts en `package.json` raíz.

Notas:

- Reglas type-checked (`tseslint.configs.recommendedTypeChecked`) sólo aplican a `apps/api/**/*.ts`, con `projectService: true` apuntando a `apps/api`.
- En `apps/web/**` se usa `next/core-web-vitals` + `next/typescript` vía `FlatCompat`. Se setea `settings.next.rootDir = 'apps/web/'` para que el rule `no-html-link-for-pages` no busque `pages/` en el root del monorepo.
- Se eliminaron las configs duplicadas de Next: `apps/api/eslint.config.mjs`, `apps/api/.prettierrc` y `apps/web/eslint.config.mjs`. Si más adelante hace falta un override per-app, vivirá en la raíz con un glob `files`.
- `apps/api/src/main.ts`: `bootstrap();` pasó a `void bootstrap();` para satisfacer `@typescript-eslint/no-floating-promises` de forma explícita.
- Husky v9 escribe el hooks path en `.husky/_`; el hook real es `.husky/pre-commit`. `pnpm prepare` lo reinstala en cada `pnpm install`.
- Verificación del hook: se commiteó un archivo deformado (`apps/api/src/_lint_probe.ts` con `"deformed"` y espacios sueltos) y lint-staged lo reformateó a `'deformed'` con semi-colon antes de quedar incluido en el commit. Después se descartó el commit de prueba.
- Limpieza de deuda: se quitaron `baseUrl` (y `paths` no usados) de `tsconfig.base.json` y `apps/api/tsconfig.json` (deuda heredada de `nest new`).

### Step 3 — Conexión a DB + primera entity (2026-05-16)

Postgres 16 corriendo en Docker vía `docker-compose.yml` en la raíz. `pnpm db:up` / `pnpm db:down` desde raíz (y desde `apps/api`) lo levantan/bajan. Conexión por `DATABASE_URL` (Postgres en `localhost:5432` con user/password/db `rutinex` en dev).

TypeORM 0.3 cableado en NestJS: `apps/api/src/config/database.ts` construye las options desde env y las consumen tanto `TypeOrmModule.forRootAsync` (runtime) como `apps/api/src/data-source.ts` (CLI de migraciones). `synchronize: false` siempre (ADR-005). `entities` y `migrations` se cargan por glob desde `src/modules/**/*.entity.ts` y `src/migrations/*.ts`.

Entity `Tenant` en `apps/api/src/modules/tenants/entities/tenant.entity.ts`: `id` (uuid, default `uuid_generate_v4()`), `slug` (varchar(63) único), `name` (varchar(255)), `branding` (jsonb, default `{}`), `is_active` (bool, default true), `created_at`/`updated_at` (timestamptz). El campo `subscription_status` queda diferido a Fase 2 (sigue documentado en `docs/02-dominio.md`).

Migración inicial: `apps/api/src/migrations/1778944394598-InitTenants.ts`. Habilita la extensión `uuid-ossp` (requerida por `uuid_generate_v4()`), crea la tabla y el índice único `uq_tenants_slug`. Up/down testeados (revert + re-run dejan el estado limpio).

Scripts:

- Raíz: `pnpm db:up`, `pnpm db:down` (`docker compose up -d postgres` / `down`).
- `apps/api`: `db:up`, `db:down` (mismo compose vía `-f ../../docker-compose.yml`), `typeorm` (wrapper de `typeorm-ts-node-commonjs -d src/data-source.ts`), `migration:generate`, `migration:run`, `migration:revert`, `db:smoke` (script `src/scripts/smoke-tenants.ts` que abre conexión y exige que `tenants` exista con 0 filas).

`.env.example`:

- Raíz: vars `POSTGRES_*` que consume docker-compose.
- `apps/api/.env.example`: `PORT`, `DATABASE_URL`, `DATABASE_LOGGING`.

Archivos clave: `docker-compose.yml`, `.env.example`, `apps/api/.env.example`, `apps/api/src/config/database.ts`, `apps/api/src/data-source.ts`, `apps/api/src/modules/tenants/entities/tenant.entity.ts`, `apps/api/src/migrations/1778944394598-InitTenants.ts`, `apps/api/src/scripts/smoke-tenants.ts`, scripts nuevos en `package.json` raíz y `apps/api/package.json`.

Notas:

- TypeORM CLI exige que `data-source.ts` exporte una sola `DataSource` (default export); con doble export (`export const` + `export default`) tira "must contain only one export of DataSource instance".
- El CLI `typeorm-ts-node-commonjs` funciona con `module: nodenext` en el tsconfig porque `apps/api/package.json` no declara `type: module`, así que Node interpreta los archivos como CJS.
- El smoke script usa `Logger` de `@nestjs/common` (sin `console.log`) para alinear con CLAUDE.md.
- `pg_isready` del healthcheck del compose evita carreras al correr migraciones inmediatamente después de `db:up`.

### Step 4 — Módulo Tenants + resolución por slug (2026-05-16)

`TenantsModule` en `apps/api/src/modules/tenants/` con:

- `TenantsService` con `create(dto)` y `findBySlug(slug)`. Tira `ConflictException` con `code: 'SLUG_RESERVED' | 'SLUG_TAKEN'` (409) y `NotFoundException` con `code: 'TENANT_NOT_FOUND'` (404). `findBySlug` también devuelve 404 si `is_active=false` (no filtra existencia, ver `docs/03-multi-tenancy.md`).
- `TenantsController` expone `POST /tenants` (público; lo va a usar signup en Step 7) y `GET /tenants/by-slug/:slug` (devuelve solo `{ id, slug, name, branding }`).
- DTOs con `class-validator`: `CreateTenantDto` valida slug (regex + longitud 3–63), name (1–255) y `BrandingDto` opcional (`primaryColor`, `accentColor`, `logoUrl`).
- Reservados y reglas de slug en `apps/api/src/modules/tenants/slug.ts` (`SLUG_REGEX`, `SLUG_MIN_LENGTH`, `SLUG_MAX_LENGTH`, `RESERVED_SLUGS`). Sincronizado con `docs/03-multi-tenancy.md`.

Pipes/filters globales vía providers en `AppModule` (para que el `TestingModule` los herede sin tocar `main.ts`):

- `APP_PIPE` → `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
- `APP_FILTER` → `HttpExceptionFilter` en `apps/api/src/common/filters/http-exception.filter.ts`. Agrega `timestamp` + `path` y propaga `code` cuando el throw fue `new ConflictException({ code, message })`. Shape estándar de `docs/05-api-conventions.md`.

Tests:

- `tenants.service.spec.ts` (unit, repo mockeado): create OK, create con branding, rechaza reservado, rechaza duplicado, findBySlug OK, findBySlug 404 inexistente, findBySlug 404 cuando `isActive=false`.
- `test/tenants.e2e-spec.ts` (e2e contra Postgres local, `TRUNCATE TABLE tenants CASCADE` en cada `beforeEach`): POST 201 mínimo, POST 201 con branding + `forbidNonWhitelisted`, POST 409 reservado, POST 409 duplicado, POST 400 regex inválido, POST 400 muy corto, POST 400 faltan campos, POST 400 propiedad no whitelisteada, GET 200 por slug, GET 404 inexistente, GET 404 cuando `is_active=false`.
- `test/jest-e2e.json` ahora carga `dotenv/config` en `setupFiles` para que `AppModule` resuelva `DATABASE_URL`.

Archivos clave: `apps/api/src/modules/tenants/{tenants.module,tenants.service,tenants.controller,slug}.ts`, `apps/api/src/modules/tenants/dto/{create-tenant,branding}.dto.ts`, `apps/api/src/modules/tenants/tenants.service.spec.ts`, `apps/api/src/common/filters/http-exception.filter.ts`, `apps/api/src/app.module.ts`, `apps/api/test/tenants.e2e-spec.ts`, `apps/api/test/jest-e2e.json`.

Notas:

- El regex de slug en `docs/03-multi-tenancy.md` estaba mal: `^[a-z0-9](-[a-z0-9]+)*$` exigía que sólo el primer carácter fuese alfanumérico antes de un hyphen-group, lo que rechazaba slugs sin guiones como `olimpo`. Quedó corregido a `^[a-z0-9]+(-[a-z0-9]+)*$` (uno o más alnum, seguido de cero o más grupos `-<alnum>+`).
- La doc decía longitud máxima 30, pero el entity ya usa `varchar(63)` (DNS label max). Alineamos la doc a 63.
- Se agregó `auth` a la lista de reservados respecto a la doc original.
- Nuevo shape de error de negocio: `ConflictException({ code: 'SLUG_RESERVED' | 'SLUG_TAKEN', message })` y `NotFoundException({ code: 'TENANT_NOT_FOUND', message })`. El filtro preserva el `code` en el body.
- El `app.e2e-spec.ts` pasó de `beforeEach` a `beforeAll` + `afterAll(app.close())` para evitar el warning "worker process failed to exit gracefully".

## Próxima acción concreta

Step 5 — Entity User + módulo Users. Criterios y detalle en `docs/07-roadmap.md`.

## Pendientes / deudas técnicas

_(vacío — `baseUrl` deprecado quedó saldado en Step 2.)_

## Decisiones pendientes (necesitan input humano)

- **Plan de billing**: si es mensual fijo por trainer o por alumno activo. No es bloqueante hasta fase 2 (step ~28+).
- **Custom domains**: si y cuándo soportar `app.gimnasioX.com.ar` apuntando a Rutinex. Diferido.
- **Catálogo global de ejercicios**: en MVP cada tenant tiene su catálogo. Si más adelante queremos un catálogo curado por nosotros, hay que pensar el merge. Diferido.

## Notas para retomar

- Si volvés y no recordás dónde quedaste, leé este archivo de arriba abajo. Si "Paso actual" no matchea con el código (ej. está marcado "Step 5" pero ya hay refresh tokens implementados), confiá en el código y corregí este archivo.
- Si la última sesión cortó a mitad de un step, debería haber commit `wip(step N): ...` en una branch y una lista checkbox abajo con lo hecho/falta. Si no la hay y el repo está sucio, primero entendé qué pasó (git status, git log) y reconciliá.
