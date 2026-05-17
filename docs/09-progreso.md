# 09 — Progreso

Estado actual del proyecto. Este archivo lo mantiene Claude Code (y vos) actualizado paso a paso. Es lo primero que se lee al retomar.

## Estado general

**Fase actual**: Fase 1 — Backend foundations (con interludio visual encima).
**Paso actual**: Step 6 completo. Próximo: Step 7 — Superadmin: schema + seed CLI + login básico.
**Última actualización**: 2026-05-17 — Step 6 (Argon2id + helpers de password).

## Cambios de doc

### 2026-05-17 — Cambio a onboarding sales-led (sin código)

El modelo pasa de PLG a sales-led: no hay signup público; el SUPERADMIN crea tenants + OWNER inicial desde un panel. Los STUDENTS se loguean por DNI. Decisiones cristalizadas en **ADR-012** (sales-led), **ADR-013** (SUPERADMIN como flag en `users`) y **ADR-014** (STUDENTS sin password). Cambios de doc aplicados (sin tocar código):

- `docs/02-dominio.md`: tabla `users` (agrega `is_superadmin`, `must_change_password`, `dni`, `password_hash`/`tenant_id` nullables, constraints e índice parcial único); glosario (agrega SUPERADMIN); jerarquía; flujos F0 (bootstrap CLI), F1 (sales-led), F2 (TRAINER con password generada), F3 (STUDENT por DNI sin password).
- `docs/03-multi-tenancy.md`: sección "Superadmin" al inicio; nuevo subdominio reservado `superadmin`; tabla de routing actualizada (sin `app.rutinex.app`, con `superadmin.rutinex.app`); casos borde rehechos; nota de `TENANT_INACTIVE` en login; el `TenantGuard` skipea `/superadmin/*`.
- `docs/04-auth.md`: reescrito. Sin `POST /auth/signup`. Login resuelve por host; nuevo `POST /auth/student-login`; `POST /auth/change-password` con modos forzado y voluntario; JWT payload nuevo (`{ sub, tenantId, role, isSuperadmin }`); política de password generada; bootstrap del SUPERADMIN por CLI; sin magic links / activation tokens.
- `docs/05-api-conventions.md`: rutas `/superadmin/*` no llevan tenant scoping; queries que no filtran por `tenant_id` deben considerar SUPERADMINs (`tenant_id IS NULL`). Códigos de error: agregados `TENANT_INACTIVE` y `USER_INACTIVE`.
- `docs/06-frontend-conventions.md`: estructura de carpetas con `superadmin/` y `t/[slug]/{login,change-password}/`; tabla de routing sin `app.rutinex.app`, con `superadmin.rutinex.app`; flujos de auth (login del tenant con tabs Staff/Alumno; login del SUPERADMIN; guard de `mustChangePassword` a nivel layout). `NEXT_PUBLIC_CONTACT_WHATSAPP` en `env`.
- `docs/07-roadmap.md`: eliminado Step 7 viejo ("Auth: signup OWNER + tenant"). Nuevo **Step 7** = "Superadmin: schema + seed CLI + login básico". **Step 8** reescrito = login normal + `student-login` + `change-password` + rechazo por `is_active=false`. Nuevo **Step 13** = "Panel superadmin (backend)". Renumerado el resto (Step 13 viejo Exercises → Step 14; etc.). Nuevo **Step 28** = "Frontend del SUPERADMIN". Step 5 (`User entity`) ya pide migración con `is_superadmin`, `must_change_password`, `dni`, `password_hash`/`tenant_id` nullables y el índice parcial único, todo en una sola pasada.
- `docs/08-decisiones.md`: agregados ADR-012, ADR-013, ADR-014 (los números 010 y 011 ya estaban tomados por decisiones previas — error shape y subdomain routing — así que la numeración pedida en la conversación se mantiene consecutiva con +2).

Pendiente para el próximo step: implementar Step 5 con el schema nuevo desde el principio (no se generan migraciones intermedias para el modelo viejo porque el código todavía no lo refleja).

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
- `TenantsController` expone `POST /tenants` (público; al momento de Step 4 se previó para signup, pero el modelo cambió a sales-led en el cambio de doc de 2026-05-17 — en Step 13 este endpoint se mueve bajo `POST /superadmin/tenants` con `SuperadminGuard`) y `GET /tenants/by-slug/:slug` (devuelve solo `{ id, slug, name, branding }`).
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

### Step 4.5 — Interludio visual: multi-tenancy en pantalla (2026-05-17)

Mini-frontend que muestra el flujo multi-tenant funcionando con lo del Step 4. No estaba en el plan original; quedó intercalado entre Step 4 y Step 5 para tener algo visceral antes de seguir con backend puro.

Backend:

- `apps/api/src/main.ts`: `app.enableCors({ origin: [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/[a-z0-9-]+\.localhost(:\d+)?$/] })` para que la web en `localhost:3000` y los subdominios `*.localhost:3000` puedan llamar al API en `localhost:3001`. En prod hay que cambiarlo por `rutinex.app` y `*.rutinex.app` (Step 27).

Frontend (`apps/web`):

- `.env.example` + `.env` con `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_ROOT_HOST`.
- `lib/env.ts`: acceso tipado a env vars con guard de "missing".
- `lib/subdomain.ts`: `extractTenantSlug(host)` extrae el slug desde `*.localhost:3000` o `*.rutinex.app`. Reservados (`www`, `app`) devuelven `null`.
- `lib/api-client.ts`: `createTenant`, `getTenantBySlug`, y `ApiClientError` tipado con `status` + `body.code`.
- `middleware.ts`: matchea todo excepto assets internos. Si hay slug, reescribe `/` a `/t/:slug` (y `/foo` a `/t/:slug/foo`). Si no, deja pasar (landing).
- `app/page.tsx`: landing con hero + form de signup (client component en `app/signup-form.tsx`). El form auto-genera slug desde el nombre, valida regex contra `^[a-z0-9]+(-[a-z0-9]+)*$` localmente, mapea `code: SLUG_TAKEN/SLUG_RESERVED` a mensajes user-friendly y redirige cross-origin a `http://${slug}.${rootHost}` post-creación.
- `app/t/[slug]/page.tsx`: server component con `dynamic = 'force-dynamic'`. Llama `getTenantBySlug`, aplica `branding.primaryColor` como CSS var y lo pinta en hero + button + badge + dots. Si hay `logoUrl` lo mete en el header. Si el API responde 404, llama `notFound()`.
- `app/t/[slug]/not-found.tsx`: 404 dedicado al tenant, con link de vuelta a la landing.
- `app/globals.css` y `app/layout.tsx`: theme dark con CSS vars (`--background`, `--foreground`, `--muted`, `--brand-primary`, etc.), `lang="es"`, metadata mínima.

Smoke manual (con `pnpm api:dev` + `pnpm web:dev` arriba):

- `GET localhost:3000/` → 200, landing con form.
- `POST localhost:3001/tenants {slug: 'demo-step-4-5', name: 'Demo Gym 4.5', branding: { primaryColor: '#22d3ee' }}` → 201 con header `Access-Control-Allow-Origin: http://localhost:3000`.
- `GET demo-step-4-5.localhost:3000/` → 200, página del tenant con el `#22d3ee` aplicado y "Demo Gym 4.5" en el header.
- `GET foo.localhost:3000/` → 404, página "Este gimnasio no existe".
- `GET www.localhost:3000/` → 200, cae a la landing (subdominio reservado).

Archivos clave: `apps/api/src/main.ts`, `apps/web/.env.example`, `apps/web/lib/{env,subdomain,api-client}.ts`, `apps/web/middleware.ts`, `apps/web/app/{layout,page,globals.css,signup-form}.tsx`, `apps/web/app/t/[slug]/{page,not-found}.tsx`.

Notas:

- shadcn/ui formal queda para el Step 20 (init + components.json). Acá fuimos con Tailwind 4 directo para no entreverar la CLI de shadcn con la config nueva de Tailwind 4 a mitad de paso.
- El middleware no rechaza tenants inexistentes: deja pasar la request hacia `/t/<slug>`; la página llama al API y si el API responde 404, se renderiza `not-found.tsx`. Beneficio: una sola fuente de verdad (el API). Costo: una request extra perdida en cada slug malicioso. Aceptable para MVP.
- El path alias `@/*` (apuntando a `./*` desde `apps/web`) ya estaba configurado en `tsconfig.json` desde el `create-next-app` del Step 1.
- `cache: 'no-store'` en `getTenantBySlug` para que el branding recién creado se vea al toque post-signup. En prod podemos pasar a `revalidate: 30` cuando convenga.

### Step 5 — Entity User + módulo Users (2026-05-17)

Tabla `users` levantada con el schema sales-led de una sola pasada (sin migraciones intermedias para el modelo viejo). Entity, módulo y service listos para que `auth` y `superadmin` los consuman en pasos siguientes.

Entity `User` en `apps/api/src/modules/users/entities/user.entity.ts`: `id`, `tenant_id` (uuid nullable + FK `RESTRICT` a `tenants`), `email` (varchar 255 nullable), `password_hash` (varchar 255 nullable), `must_change_password` (bool default false), `is_superadmin` (bool default false), `first_name`/`last_name` (varchar 100), `dni` (varchar 20 nullable), `role` (enum nullable: `OWNER`/`TRAINER`/`STUDENT`), `trainer_id` (uuid nullable + FK self `SET NULL`), `is_active` (bool default true), `last_login_at` (timestamptz nullable), `created_at`/`updated_at`. Índices: `ix_users_tenant_id`, `uq_users_tenant_email` (compuesto único), `uq_users_tenant_dni` (compuesto único) y el parcial único `users_email_global_unique ON users(email) WHERE tenant_id IS NULL` (para SUPERADMINs).

Migración `apps/api/src/migrations/1779120000000-InitUsers.ts` escrita a mano (mismo patrón que `InitTenants`): crea `public.user_role` (enum), crea `users` con los FKs nombrados explícito (`fk_users_tenant`, `fk_users_trainer`), crea los cuatro índices. `up`/`down` probados con `migration:run` + `migration:revert` + `migration:run` (drift check via `migration:generate` no encuentra cambios).

`UsersModule` en `apps/api/src/modules/users/users.module.ts`: solo `TypeOrmModule.forFeature([User])` + `UsersService`. **Sin controller** todavía (Step 7 y Step 13 lo consumen vía service).

`UsersService` en `apps/api/src/modules/users/users.service.ts`:

- Helpers: `findByEmailAndTenant(tenantId, email)` (excluye `is_superadmin=true`), `findSuperadminByEmail(email)` (matchea índice parcial: `tenant_id IS NULL` + `is_superadmin=true`), `findStudentByDniAndTenant(tenantId, dni)` (filtra `role='STUDENT'`).
- `create(input)` con validación por rol vía `BadRequestException` con `code` parseable (SUPERADMIN: `tenant_id`/`role` deben ser NULL, password requerido, sin DNI ni trainer; STUDENT: `tenant_id`+`dni` requeridos, password debe ser NULL — ADR-014; STAFF: `tenant_id`+`email`+`password_hash` requeridos, sin DNI). Pre-check de unicidad usando los mismos helpers, tira `ConflictException` con `code` (`SUPERADMIN_EMAIL_TAKEN`/`EMAIL_TAKEN`/`DNI_TAKEN`) antes de tocar la DB.
- `setActive(id, isActive)` y `setMustChangePassword(id, value)`: update directo, 404 si no afecta filas.

Tests (`users.service.spec.ts`, repo mockeado): cada helper (shape del where), cada constraint de validación por rol (SUPERADMIN, STAFF, STUDENT — un caso por invariante), cada `ConflictException` por UNIQUE compuesto + el caso "mismo email/DNI en otro tenant pasa OK" (asegura que el chequeo es por `(tenant_id, X)` y no global), y los dos setters incluyendo el 404.

Cleanup colateral: en `tenant.entity.ts`, el default de `branding` pasó de `() => "'{}'::jsonb"` a `() => "'{}'"` para eliminar el drift simétrico que el detector de migraciones de TypeORM venía marcando (no afecta el comportamiento runtime — jsonb acepta el text constant sin cast explícito).

Archivos clave: `apps/api/src/modules/users/{entities/user.entity,users.module,users.service,users.service.spec}.ts`, `apps/api/src/migrations/1779120000000-InitUsers.ts`, `apps/api/src/app.module.ts` (import del módulo), `apps/api/src/modules/tenants/entities/tenant.entity.ts` (default de branding).

Verificación: `pnpm lint` clean en root; `pnpm test` (apps/api) 37/37 verde; `pnpm test:e2e` 12/12 verde sin regresiones del Step 4.

Notas:

- Los FK constraints van con nombre explícito (`foreignKeyConstraintName`) para que TypeORM no detecte drift contra los nombres generados.
- El service rechaza estados imposibles con `BadRequestException` + `code` (`SUPERADMIN_MUST_HAVE_NO_TENANT`, `STUDENT_NO_PASSWORD`, etc.) antes de invocar la DB. Si más adelante el `code` se necesita en el frontend, queda agregarlo a la tabla de `docs/05-api-conventions.md` cuando un endpoint lo exponga (en Step 5 ningún endpoint expone estos errores todavía, así que no se documenta como contrato público aún).
- `subscription_status` sigue diferido (no aparece en la entity ni en la migración), alineado con `docs/02-dominio.md`.

### Step 6 — Argon2 + helpers de password (2026-05-17)

`AuthModule` mínimo (sin controllers todavía) en `apps/api/src/modules/auth/` con `PasswordService` que centraliza hash, verify y generación de passwords. Dependencia `argon2` (^0.44.0) agregada a `apps/api`.

`PasswordService` en `apps/api/src/modules/auth/password.service.ts`:

- `hash(plain)`: Argon2id con `memoryCost=19456`, `timeCost=2`, `parallelism=1` (mínimo OWASP 2024 — ver `docs/04-auth.md`). Constantes exportadas como `ARGON2_OPTIONS` para que los tests las consuman sin duplicarlas.
- `verify(hash, plain)`: wraps `argon2.verify` en try/catch y devuelve `false` ante hash corrupto o algoritmo no soportado (queremos 401 genérico en login, no 500).
- `generate()`: 16 chars de un alfabeto de 56 símbolos (`[a-zA-Z0-9]` menos `0`, `O`, `o`, `1`, `l`, `I`). Usa `crypto.randomBytes` con rejection sampling (`maxValid = 256 - 256 % 56 = 224`) para evitar sesgo modular. Constantes `GENERATED_PASSWORD_ALPHABET` y `GENERATED_PASSWORD_LENGTH` exportadas.

Tests (`password.service.spec.ts`, 8 cases):

- hash + verify roundtrip; verify rechaza password incorrecta; verify devuelve `false` (no throw) ante hash corrupto; el string del hash contiene `m=19456`, `t=2`, `p=1`.
- `generate()` produce strings del largo esperado; sólo usa caracteres del alfabeto permitido; nunca incluye `0/O/o/1/l/I`; 20 invocaciones devuelven 20 valores distintos.

`AuthModule` registrado en `AppModule` para que esté disponible cuando Step 7 cablée el primer endpoint de auth.

Archivos clave: `apps/api/src/modules/auth/{password.service,password.service.spec,auth.module}.ts`, `apps/api/src/app.module.ts` (import del módulo), `apps/api/package.json` (+`argon2`).

Verificación: `pnpm --filter @rutinex/api test` 45/45 verde (37 previos + 8 nuevos). `pnpm lint` clean.

Notas:

- `argon2.verify` puede tirar (no devolver `false`) si el hash no parsea. El wrap en try/catch convierte eso en `false` para que el caller no tenga que distinguir entre "no matchea" y "no es un hash válido" — los dos llevan al mismo 401 genérico.
- Se eligió `crypto.randomBytes` + rejection sampling sobre `crypto.randomInt` para apegarse al criterio explícito del Step 6 ("CSPRNG via `crypto.randomBytes`") y dejar visible el cálculo de `maxValid` que evita el sesgo modular.
- `docs/04-auth.md` ya documenta la política completa (params Argon2id y alfabeto sin ambiguos); este step solo la implementa, no la cambia.

## Próxima acción concreta

Step 7 — Superadmin: schema + seed CLI + login básico. Migración ya está aplicada (Step 5). Falta script `pnpm --filter api seed:superadmin` que hashea con `PasswordService.hash`, crea el SUPERADMIN, y un `POST /auth/login` mínimo que soporte el host `superadmin.*` con emisión de JWT (sin refresh todavía) + `SuperadminGuard`. Criterios en `docs/07-roadmap.md` Step 7.

## Pendientes / deudas técnicas

_(vacío — `baseUrl` deprecado quedó saldado en Step 2.)_

## Decisiones pendientes (necesitan input humano)

- **Modelo de onboarding**: ya decidido. Cambió de PLG a sales-led — ver ADR-012, ADR-013, ADR-014.
- **Plan de billing**: si es mensual fijo por trainer o por alumno activo. No es bloqueante hasta fase 2.
- **Custom domains**: si y cuándo soportar `app.gimnasioX.com.ar` apuntando a Rutinex. Diferido.
- **Catálogo global de ejercicios**: en MVP cada tenant tiene su catálogo. Si más adelante queremos un catálogo curado por nosotros, hay que pensar el merge. Diferido.
- **`POST /users/:id/reset-password`**: si va como una sola ruta con autorización por jerarquía (OWNER → TRAINER del mismo tenant; SUPERADMIN → OWNER) o si el reset de OWNER va separado bajo `/superadmin/...`. Decidir en Step 12 / Step 13.

## Notas para retomar

- Si volvés y no recordás dónde quedaste, leé este archivo de arriba abajo. Si "Paso actual" no matchea con el código (ej. está marcado "Step 5" pero ya hay refresh tokens implementados), confiá en el código y corregí este archivo.
- Si la última sesión cortó a mitad de un step, debería haber commit `wip(step N): ...` en una branch y una lista checkbox abajo con lo hecho/falta. Si no la hay y el repo está sucio, primero entendé qué pasó (git status, git log) y reconciliá.
