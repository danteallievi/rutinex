# 09 — Progreso

Estado actual del proyecto. Este archivo lo mantiene Claude Code (y vos) actualizado paso a paso. Es lo primero que se lee al retomar.

## Estado general

**Fase actual**: Fase 1 — Backend foundations.
**Paso actual**: Step 11 completo. Próximo: Step 12 — CRUD: Users del tenant (alta de TRAINER y STUDENT).
**Última actualización**: 2026-05-17 — Step 11 (RolesGuard global + @Roles decorator + ADR-019 SUPERADMIN bypass).

## Cambios de doc

### 2026-05-17 — Arquitectura de design tokens + stack tipográfico (sin código)

Codificación de la arquitectura visual **antes** de implementar el toggle dark/light (Fase 4), para que el step de implementación sea traducción mecánica del ADR y no mezclado refactor + feature. También deja decidido el swap tipográfico (Geist → Montserrat sans + JetBrains Mono mono) para que entre en el mismo step de refactor visual y no como cambio suelto. Sin tocar código todavía (los mockups del Step 7.5 quedan con Geist hasta que entre la Fase 4).

- `docs/08-decisiones.md`: nuevo **ADR-016** — sistema de design tokens en 3 capas (brand → semantic → component) + tenant overlay acotado a un set de vars overridables + stack tipográfico (Montserrat / JetBrains Mono, serif diferido a cuando aparezca el caso).
- `docs/06-frontend-conventions.md`: reescrita la sección "Theming y branding" con la arquitectura nueva (las 3 capas, la regla mental para consumir cada una, el contrato del tenant overlay vía `tenantThemeVars(branding)`, el plan de dark/light, el stack de fuentes, y una nota explícita de que el código actual de `globals.css` es preliminar — la migración va en Fase 4).
- `docs/07-roadmap.md`: el item de Fase 4 "Toggle dark/light theme" se reescribió como un paquete único de refactor visual con 7 sub-tareas concretas (partir `globals.css`, renombrar vars semánticas, `lib/theme.ts`, swap de fuentes, variante light, toggle en las 4 surfaces, smoke visual sobre las 9 rutas del Step 7.5). Criterio explícito: rebrand hipotético = tocar solo capa 1.

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

### Step 7 — Superadmin: schema + seed CLI + login básico (2026-05-17)

Bootstrap del SUPERADMIN + login mínimo del surface `/superadmin/*` con guard end-to-end. Sin refresh tokens todavía (eso es Step 9). Dependencias nuevas en `apps/api`: `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `@types/passport-jwt`.

**Seed CLI** — `pnpm --filter @rutinex/api seed:superadmin` (`apps/api/src/scripts/seed-superadmin.ts`):

- Lee email + password desde stdin. En TTY oculta el password con `setRawMode`; en modo piped lee todo stdin como dos líneas (workaround del bug de `readline.question` cuando stdin EOFa entre prompts en modo no-TTY).
- Valida email (regex razonable, no RFC) y largo mínimo 12 chars (`MIN_HUMAN_PASSWORD_LENGTH` en `seed-superadmin.ts`).
- Hashea con `PasswordService.hash` y delega a `UsersService.create({ isSuperadmin: true, tenantId: null, role: null, mustChangePassword: false, ... })`. Defaults `firstName='Super'`/`lastName='Admin'` (el roadmap solo exige email + password).
- Si colisiona con el índice parcial único `users_email_global_unique`, `UsersService` tira `ConflictException({ code: 'SUPERADMIN_EMAIL_TAKEN' })`; el script lo detecta con `isSuperadminEmailTakenError` y sale con `exit=2` + mensaje claro. Errores de validación → `exit=1`. Documentación en `apps/api/scripts/README.md`.

**`POST /auth/login`** (Step 7 = solo SUPERADMIN):

- `apps/api/src/modules/auth/auth.controller.ts` recibe `LoginDto { email, password }` y resuelve la superficie con `extractHostname(req.headers)` + `isSuperadminHost(...)` (`apps/api/src/modules/auth/host.ts`). El extractor prefiere el header `x-rutinex-host` cuando existe (override para tests sin tener que jugar con `.set('Host', ...)` en todos lados, aunque ambos funcionan).
- `AuthService.login(host, dto)` corta short-circuit con `401 INVALID_CREDENTIALS` si el host no es SUPERADMIN — no se filtra existencia entre superficies (alguien usando creds de SUPERADMIN desde `<slug>.rutinex.app` ve exactamente la misma 401 que si las credenciales fueran inválidas).
- En el flujo SUPERADMIN: busca con `findSuperadminByEmail`; si no existe o password no matchea → 401 `INVALID_CREDENTIALS`; si `is_active=false` → 403 `USER_INACTIVE`; si todo OK, firma JWT con payload `{ sub, tenantId: null, role: null, isSuperadmin: true }` y devuelve `{ accessToken, user: { id, role: null, isSuperadmin: true, mustChangePassword, firstName, lastName, tenant: null } }`. **Sin `refreshToken` todavía** (Step 9).

**JWT** — `JwtModule.registerAsync` con secret `JWT_ACCESS_SECRET` (env), HS256, `expiresIn: '15m'`. `JwtStrategy` (passport-jwt, Authorization: Bearer) mapea el payload a `AuthenticatedUser { userId, tenantId, role, isSuperadmin }` en `req.user`. `JwtAuthGuard` es el `AuthGuard('jwt')` standard. `SuperadminGuard` (custom) tira `403 NOT_SUPERADMIN` si `req.user.isSuperadmin !== true`. Se aplican en orden `JwtAuthGuard → SuperadminGuard` a nivel controller (Step 10 va a montar el JwtAuthGuard como global).

**Endpoint dummy del surface superadmin** — `GET /superadmin/ping` (`apps/api/src/modules/superadmin/superadmin.controller.ts`). Solo existe para probar el guard end-to-end: 200 con JWT de SUPERADMIN, 401 sin JWT / token inválido, 403 con JWT no-superadmin (`NOT_SUPERADMIN`). Step 13 lo reemplaza con CRUD real de tenants.

**Drift fix colateral**: `apps/api/src/modules/tenants/slug.ts` no incluía `superadmin` en `RESERVED_SLUGS` aunque `docs/03-multi-tenancy.md` lo listaba. Agregado.

Archivos clave: `apps/api/src/modules/auth/{auth.controller,auth.service,auth.module,host,jwt-payload,jwt.strategy,jwt-auth.guard,superadmin.guard,seed-superadmin}.ts` + sus `*.spec.ts`, `apps/api/src/modules/auth/dto/login.dto.ts`, `apps/api/src/modules/superadmin/{superadmin.controller,superadmin.module}.ts`, `apps/api/src/scripts/seed-superadmin.ts`, `apps/api/scripts/README.md`, `apps/api/package.json` (+`seed:superadmin` script), `apps/api/.env.example` + `.env.example` raíz (`JWT_ACCESS_SECRET`), `apps/api/test/auth.e2e-spec.ts`, `apps/api/test/jest-e2e.json` (`maxWorkers: 1` para serializar E2E que comparten DB), `docs/04-auth.md`, `docs/05-api-conventions.md` (tabla de codes), `apps/api/src/app.module.ts`.

Verificación: `pnpm lint` clean. `pnpm --filter @rutinex/api test` 71/71 (45 previos + 26 nuevos en host/auth-service/seed/superadmin-guard). `pnpm --filter @rutinex/api test:e2e` 23/23 (12 tenants previos + 11 nuevos en `auth.e2e-spec.ts`). Smoke del CLI: primer run crea, segundo run con mismo email sale exit 2 con `Ya existe un SUPERADMIN con ese email.`

Notas:

- E2E ahora corre con `maxWorkers: 1`. Antes con un solo spec no había problema; sumar `auth.e2e-spec.ts` que también escribe en `users`/`tenants` exponía una carrera con `tenants.e2e-spec.ts`. Serializar es la opción simple; alternativa futura (cuando duela), schemas por worker.
- `extractHostname` lee `x-rutinex-host` antes que `Host`. El header de override permite tests sin tener que forzar `Host` (aunque `Host` también se respeta — los E2E lo prueban con ambos).
- El `INVALID_CREDENTIALS` 401 cubre tres casos (host inválido, user inexistente, password incorrecta). Ningún caller necesita distinguirlos — el frontend muestra el mismo mensaje "Email o contraseña inválidos."
- La password mínima en el CLI es 12 chars. En `change-password` (Step 8) habrá una política de fortaleza pública; por ahora 12 es un default razonable para no exponer al bootstrap a passwords débiles.

### Step 7.5 — Sprint visual multi-surface (interludio, 2026-05-17)

Material de venta navegable para demos comerciales. **Frontend puro, datos fake, descartable**: los mockups se reemplazan por implementaciones reales en Steps 21-28 — sirven como referencia visual, no se promete que el código sobreviva. No toca backend ni docs de dominio. Fuera de la numeración del roadmap (mismo patrón que Step 4.5).

Estructura: 4 sub-agentes paralelos (uno por surface, sin colisión de archivos), orquestados por el thread principal (mock data compartida + validación + commit único). Patrón de ADR-015.

**Setup (Agente A)**:

- `shadcn/ui` inicializado (`pnpm dlx shadcn@latest init` con preset `base-nova` — base-ui en lugar de radix; los componentes Tailwind 4 funcionan igual). `apps/web/components.json`, `apps/web/lib/utils.ts`, y `apps/web/components/ui/{button,card,badge,dialog,input,label,sheet,table,sonner}.tsx` generados. `sonner` reemplaza `toast` (no existe en `base-nova`).
- `apps/web/app/globals.css`: integra las CSS vars que necesita shadcn (`--card`, `--primary`, `--ring`, etc.) preservando las nuestras (`--background`, `--foreground`, `--brand-primary`, etc.). `--primary` y `--ring` se setean al naranja del proyecto (`#f97316`) para que los componentes shadcn respeten el accent sin variants custom.
- Landing comercial sales-led en `apps/web/app/page.tsx`: hero "Tu gimnasio, tu marca, tu plataforma", 4 beneficios, sección "cómo funciona", 3 tiers (Solo USD 19 / Equipo USD 49 / Red a medida), todos los CTA apuntan a `https://wa.me/${env.contactWhatsapp}` (`target="_blank" rel="noopener noreferrer"`). Server Component, mobile-first, estética editorial dark con halo radial naranja. `apps/web/app/signup-form.tsx` **borrado** (sales-led, ya no aplica).
- `apps/web/middleware.ts`: chequea `isSuperadminHost` antes que tenant; `superadmin.*` rewrite a `/superadmin/...`. Mantenido el rewrite de tenant (`<slug>.*` → `/t/<slug>/...`).
- `apps/web/lib/subdomain.ts`: `RESERVED_HOST_PREFIXES = {'www','superadmin'}` (saqué `app` por ADR-012). Agregado `isSuperadminHost(host)`.
- `apps/web/lib/env.ts`: agregado `contactWhatsapp` (required, `NEXT_PUBLIC_CONTACT_WHATSAPP`). `.env.example` + `.env` con placeholder `5491100000000`.
- `apps/web/lib/mock-data.ts`: contrato compartido por los 4 agentes. Tipos (`MockTenant`, `MockUser`, `MockExercise`, `MockRoutineItem`, `MockRoutine`, `MockSession`, `MockSet`) + arrays (1 owner, 3 trainers, 14 alumnos del tenant `olimpo`; 8-10 tenants en `mockTenants`; 12 ejercicios; 4 rutinas; 4 sesiones; 16 sets). IDs cortos legibles (`u-student-1`, `ex-bench-press`, etc.) para facilitar debugging. Helpers `getStudentById`, `getExerciseById`, `getRoutineById`, `getRoutineForStudentToday`, `getStudentsByTrainerId`.
- `apps/web/app/t/[slug]/page.tsx`: reemplazado por **selector demo** con dos cards "Ver como admin" / "Ver como alumno" (link a `/admin` y `/student`). Aplica branding del tenant; try/catch sobre `getTenantBySlug` con fallback a `olimpoTenant` del mock para que el demo no rompa si el API está caído.

**Admin mockup (Agente B)** — `apps/web/app/t/[slug]/(admin)/admin/...`:

- `(admin)/layout.tsx`: sidebar fija desktop + topbar mobile con drawer (single `'use client'` aislado en `_components/admin-mobile-nav.tsx`). Branding del tenant (CSS vars en el wrapper alto). Nav: Dashboard, Alumnos, Rutinas (próximamente), Ejercicios (próximamente). Footer con `olimpoOwner`.
- `admin/page.tsx`: dashboard con 4 stat cards (activos / sesiones 7d / pendientes / sin actividad) + bitácora de últimas 5 sesiones con badges Completa/En curso.
- `admin/students/page.tsx`: tabla desktop (`≥md`) + lista de cards mobile. Buscador placeholder + segmented control "Todos/Activos/Inactivos" (visual). Cada fila linkea a `/admin/students/[id]`.
- `admin/students/[id]/page.tsx`: header con avatar grande + DNI + estado; info card lateral (email, trainer, alta, último ingreso); tabs visuales (Rutinas activa, las otras placeholder); rutina renderizada con 5 ejercicios resueltos vía `getExerciseById`.
- Estética: editorial-precision dark, hairlines, micro-tipografía mono uppercase para labels, números tabulares, naranja reservado para acentos.

**Student mockup (Agente C)** — `apps/web/app/t/[slug]/(student)/student/...`:

- `(student)/layout.tsx`: header sticky desktop con tabs + bottom nav mobile (`_components/student-bottom-nav.tsx`, único `'use client'`, usa `usePathname` para active state). Tap targets ≥64px, `safe-area-inset-bottom`.
- `student/page.tsx`: home "Hoy" con saludo + fecha + card grande de la sesión del día (flip de contraste `bg-foreground`/`text-background` para hacerla focal); lista de 5 ejercicios checkeables con link al detalle; botón gigante "Completar sesión"; sección "Próximas sesiones".
- `student/exercises/[id]/page.tsx`: hero con título + chips de músculos + placeholder de video (gradiente con `color-mix(in srgb, var(--brand-primary)...)` + grid texture); descripción; tabla de sets editables (`<input type="number">` con `defaultValue`, sin lógica); botón "Guardar y volver".
- Estética: hermana del admin pero más bold y energética. Display ultra-bold tracking-tight; numerales `tabular-nums` para sets/reps; CTA estilo "botón de gimnasio premium" con uppercase + tracking + color brand.

**Superadmin mockup (Agente D)** — `apps/web/app/superadmin/...`:

- `layout.tsx`: header sticky con brandmark "R", badge `internal` con dot incandescente, perfil del operador + botón "Salir". Topbar horizontal con `Tenants` (activo), `Operadores`/`Auditoría`/`Configuración` (disabled, marcados `soon`). Status pill `api · ok / db · ok` en desktop. Fondo `#070707` (más oscuro que `--background`) para separar este surface del de tenant.
- `page.tsx`: `redirect('/superadmin/tenants')`.
- `tenants/page.tsx`: header con breadcrumb mono + contadores activos/inactivos + CTAs "Exportar CSV" y "+ Nuevo tenant"; toolbar con buscador (`kbd "/"`) + tabs segmentadas + contador "Mostrando N de total"; tabla densa de 7 columnas (slug mono con dot brand, nombre + UUID, badge estado, alumnos/trainers `tabular-nums`, creado en dos líneas, acciones Ver/Reset OWNER/toggle). Mobile: cards apiladas con stat-grid. Hover muestra franja lateral con el color de branding del tenant.

**Decisiones operativas (orquestación)**:

- Route groups + subprefijo URL para evitar colisión: `(admin)/admin/...` y `(student)/student/...` conviven dentro de `app/t/[slug]/` porque las URLs efectivas son `/admin` y `/student`, no `/`. Si los dos route groups hubieran tenido `page.tsx` en su raíz, Next habría tirado conflicto.
- Mock data primero: el contrato de `lib/mock-data.ts` se definió upfront en el prompt de cada agente, así los 4 pudieron correr en paralelo (B/C/D imports al contrato, A genera el archivo).
- Fixes manuales del thread principal post-merge: 1 type error (`InfoRow value` esperaba `string` y `student.email` es `string | null` — coalescing a `'sin email'`); 4 archivos con drift de Prettier (auto-fix vía `pnpm lint:fix`).

**Verificación**:

- `pnpm lint` clean. `pnpm format:check` clean.
- `pnpm --filter @rutinex/web exec tsc --noEmit` clean.
- `pnpm --filter @rutinex/web build` compila todas las rutas:
  - Estáticas: `/`, `/superadmin`, `/superadmin/tenants`.
  - Dinámicas: `/t/[slug]`, `/t/[slug]/admin`, `/t/[slug]/admin/students`, `/t/[slug]/admin/students/[id]`, `/t/[slug]/student`, `/t/[slug]/student/exercises/[id]`.
- Smoke del middleware con `curl` + `Host:` header:
  - `localhost:3000/` → 200 (landing).
  - `superadmin.localhost:3000/` → 307 → `/superadmin/tenants` 200.
  - `olimpo.localhost:3000/` → 200 (selector demo, fallback a mock cuando API no responde con un tenant `olimpo`).
  - `olimpo.localhost:3000/admin` → 200 (dashboard).

**Notas**:

- shadcn quedó inicializado pero NO se usó en los mockups: B/C/D optaron por Tailwind directo para no bloquearse esperando a A en paralelo. Los componentes shadcn están disponibles para Step 21+.
- `sonner` queda como reemplazo de `toast` en `base-nova` — si en Step 21 preferimos toasts shadcn radix-based, se reemplaza ahí.
- Link "Ver" del superadmin apunta a `/superadmin/tenants/[slug]` (no existe en este sprint; romperá hasta Step 28).
- El selector demo de `/t/[slug]/page.tsx` se elimina cuando entre Step 22 (auth + flujo real de login).

Archivos clave: `apps/web/app/page.tsx`, `apps/web/app/t/[slug]/page.tsx`, `apps/web/app/t/[slug]/(admin)/{layout,admin/page,admin/students/page,admin/students/[id]/page}.tsx` + `(admin)/_components/admin-mobile-nav.tsx`, `apps/web/app/t/[slug]/(student)/{layout,student/page,student/exercises/[id]/page}.tsx` + `(student)/_components/student-bottom-nav.tsx`, `apps/web/app/superadmin/{layout,page,tenants/page}.tsx`, `apps/web/lib/{mock-data,subdomain,env,utils}.ts`, `apps/web/middleware.ts`, `apps/web/components/ui/*`, `apps/web/components.json`, `apps/web/app/globals.css`, `apps/web/.env.example` + `.env`, `apps/web/package.json` + `pnpm-lock.yaml` (deps de shadcn).

### Step 8 — Auth: login de tenant + student-login + change-password + tenant inactive (2026-05-17)

Completa el surface auth para los tres roles del tenant (OWNER/TRAINER por email+password, STUDENT por DNI) y deja `change-password` operativo para ambos modos (forzado y voluntario). `JwtAuthGuard` pasa a ser global, con `@Public()` para opt-out. Sin refresh tokens todavía (Step 9).

**Cambios en `host.ts`**: nuevo `extractTenantSlug(hostname)` — parsea el primer label del hostname y devuelve el slug si matchea el regex DNS-safe y no es un prefijo reservado (`www`, `superadmin`). No consulta DB. `isSuperadminHost` queda igual.

**`POST /auth/login`** (extendido):

- Host `superadmin.*` → flujo SUPERADMIN (sin cambios respecto a Step 7).
- Host `<slug>.*` con slug válido → resuelve tenant vía `TenantsService.findBySlugIncludingInactive(slug)` (nuevo método que NO tira 404 cuando el tenant está pausado, a diferencia del `findBySlug` público que sigue tirándolo para no filtrar existencia en la página del tenant). Si el tenant no existe → 401 genérico. Si `is_active=false` → 403 `TENANT_INACTIVE`. Busca user por `findByEmailAndTenant(tenant.id, email)`. Si no existe o no tiene password → 401 genérico. Si `user.is_active=false` → 403 `USER_INACTIVE`. Verifica password, emite JWT con `{ sub, tenantId, role, isSuperadmin: false }`.
- Cualquier otro host (sin punto, sin slug válido, prefijo reservado) → 401 genérico.
- Response shape: `{ accessToken, user: { id, role, isSuperadmin, mustChangePassword, firstName, lastName, tenant: { id, slug, name } | null } }`.

**`POST /auth/student-login`** (nuevo): solo válido en hosts de tenant. Body `{ dni }`. Mismas reglas de TENANT_INACTIVE / USER_INACTIVE. `mustChangePassword` siempre `false` para STUDENTS. Si llega desde `superadmin.*` → 401 genérico (no se filtra que este endpoint no exista en ese surface). DTO valida `dni: ^[0-9]+$` (4-20 chars) → 400 si no es numérico.

**`POST /auth/change-password`** (nuevo):

- Requiere JWT válido (lo cubre el `JwtAuthGuard` global, sin `@Public()`). Resuelve el user con `UsersService.findById(sub)`.
- Si `user.must_change_password=true` → modo forzado: acepta sólo `newPassword`. Si llega `currentPassword`, se ignora.
- Si `user.must_change_password=false` → modo voluntario: requiere `currentPassword`. Si falta → 400 `CURRENT_PASSWORD_REQUIRED`. Si no matchea → 401 `INVALID_CREDENTIALS`.
- Hashea con `PasswordService.hash` y atómicamente setea `password_hash` + `must_change_password=false` vía `UsersService.setPassword(id, hash)` (nuevo método).
- TODO Step 9: revocar todos los refresh tokens del user.
- Política mínima de fortaleza: `MIN_USER_PASSWORD_LENGTH = 12` (exportada desde `password.service.ts`, alineada con el CLI seed). Validada por el DTO con `@MinLength`. Sin reglas extra de complejidad por ahora; en `docs/04-auth.md` queda documentada la decisión.
- Devuelve 204 (HttpStatus.NO_CONTENT).

**`JwtAuthGuard` global**: registrado como `APP_GUARD` en `AuthModule`. Usa `Reflector` para detectar el meta `IS_PUBLIC_KEY` y saltarse handlers/controllers marcados con `@Public()`. Decorador `@Public()` agregado en `apps/api/src/modules/auth/public.decorator.ts`. Aplicado a: `AppController` (clase, healthcheck `GET /`), `TenantsController` (clase, `POST /tenants` y `GET /tenants/by-slug/:slug`), y los métodos `login` + `studentLogin` en `AuthController`. El `SuperadminController` ya no necesita `@UseGuards(JwtAuthGuard)` (lo cubre el global); queda sólo `@UseGuards(SuperadminGuard)`.

**`TenantsService.findBySlugIncludingInactive(slug)`**: devuelve el tenant aunque `is_active=false`. Lo necesita el auth flow para distinguir "slug no existe" (401) de "tenant pausado" (403). El método público `findBySlug` sigue tirando 404 para ambos casos (filtra existencia).

**`UsersService.findById(id)` y `setPassword(id, hash)`**: dos helpers nuevos. `findById` resuelve el user del JWT en `change-password`. `setPassword` actualiza `password_hash` y limpia `must_change_password` en la misma sentencia (atómico).

**Decisión: no se implementa LocalStrategy**. El roadmap lo mencionaba como parte del Step 8, pero ya validamos credenciales directo en el service (mismo patrón que Step 7) y agregarlo era ceremony pura: LocalStrategy sólo cobra valor cuando se usa `@UseGuards(AuthGuard('local'))` para inyectar `req.user` en el handler, y nuestro `login` parsea el body directamente. Si en el futuro queremos passport-local por consistencia con docs/standards, se agrega ahí — sin perder nada de seguridad por dejarlo afuera.

**Códigos de error nuevos** (documentados en `docs/05-api-conventions.md`):

- 400 `CURRENT_PASSWORD_REQUIRED` (change-password en modo voluntario sin la password actual).
- `TENANT_INACTIVE` y `USER_INACTIVE` (ya estaban listados pero ahora se emiten desde login + student-login).

Tests:

- Unit (`auth.service.spec.ts`): 23 casos cubriendo SUPERADMIN, tenant (OK, tenant inexistente, tenant inactivo, user inexistente, user inactivo, password incorrecta), student-login (todos los casos), change-password (forzado, voluntario sin currentPassword, voluntario con currentPassword mal, voluntario OK, user inexistente, user sin password).
- Host (`host.spec.ts`): + 4 cases para `extractTenantSlug` (extracción, reservados, hosts sin punto, slugs inválidos, slugs con guiones).
- E2E (`auth.e2e-spec.ts`): cubre los 7-8 casos del roadmap — OWNER login tenant, TRAINER con password generada, STUDENT por DNI, cross-host (SUPERADMIN desde tenant, OWNER desde superadmin), TENANT_INACTIVE, USER_INACTIVE, must_change_password roundtrip completo (login → 204 change → password vieja falla → password nueva funciona → mustChangePassword=false), change-password voluntario (400 sin currentPassword, 401 con currentPassword mal, 204 con currentPassword OK, 400 con newPassword < 12 chars). Mantiene los E2E del Step 7 sin regresión.

Verificación: `pnpm lint` clean en root. `pnpm --filter @rutinex/api test` 94/94 (71 previos + 23 nuevos en host + auth-service). `pnpm --filter @rutinex/api test:e2e` 41/41 (23 previos del Step 7 + 18 nuevos en auth.e2e-spec.ts).

Archivos clave: `apps/api/src/modules/auth/{auth.service,auth.controller,auth.module,host,jwt-auth.guard,public.decorator,password.service}.ts` + `dto/{student-login,change-password}.dto.ts` + sus `*.spec.ts`, `apps/api/src/modules/users/users.service.ts` (`findById`, `setPassword`), `apps/api/src/modules/tenants/{tenants.service,tenants.controller}.ts` (`findBySlugIncludingInactive` + `@Public()`), `apps/api/src/modules/superadmin/superadmin.controller.ts` (saca el `JwtAuthGuard` explícito), `apps/api/src/app.controller.ts` (`@Public()`), `apps/api/test/auth.e2e-spec.ts`, `docs/04-auth.md`, `docs/05-api-conventions.md`.

Notas:

- El parser de host es liberal: `extractTenantSlug('rutinex.app')` devuelve `'rutinex'`. No es un problema porque `rutinex` está en la lista de slugs reservados (`apps/api/src/modules/tenants/slug.ts`) y no puede existir en DB → la query devuelve null → 401 genérico. El parser sólo skipea explícitamente `www` y `superadmin` porque son surfaces distintas (no deben caer en el flujo de tenant).
- Filtrado de existencia parcial: si alguien adivina el slug correcto pero el tenant está inactivo, recibe `TENANT_INACTIVE` (mensaje "Tu cuenta está pausada..."). Esto leakea existencia de tenants inactivos. La doc lo acepta como trade-off (mensaje pensado para el OWNER legítimo). Si más adelante queremos blindar, se puede retornar 401 genérico también para inactivos y mostrar el mensaje friendly recién después del primer login exitoso del OWNER.
- El `@Public()` decorator vive en `apps/api/src/modules/auth/` pero lo consumen también `TenantsController` y `AppController`. No genera ciclo de módulos porque el decorator es un standalone (no importa nada de `auth.module`).
- `MIN_HUMAN_PASSWORD_LENGTH` en `seed-superadmin.ts` ahora es un re-export de `MIN_USER_PASSWORD_LENGTH` (en `password.service.ts`) — un solo lugar de verdad para que CLI seed y `change-password` no driften.

### Step 9 — Auth: refresh tokens + rotación + detección de reuso (2026-05-17)

Refresh tokens rotativos persistidos por hash, con detección de reuso, endpoints de logout, integración en login/student-login y revocación al cambiar password. Cookie httpOnly opcional vía body o cookie (ADR-017).

**Entity + migración**: `RefreshToken` en `apps/api/src/modules/auth/entities/refresh-token.entity.ts` con `id`, `tenant_id` (nullable, FK CASCADE a `tenants`), `user_id` (FK CASCADE a `users`), `token_hash` (varchar(64) UNIQUE), `expires_at`, `revoked_at`, `replaced_by` (FK self SET NULL), `user_agent` (255), `ip` (45), `created_at`. Migración `apps/api/src/migrations/1779200000000-InitRefreshTokens.ts` a mano con FKs nombrados (`fk_refresh_tokens_user`, `fk_refresh_tokens_tenant`, `fk_refresh_tokens_replaced_by`) e índices: `ix_refresh_tokens_tenant_id`, `ix_refresh_tokens_user_id`, `uq_refresh_tokens_token_hash` (UNIQUE), `ix_refresh_tokens_expires_at`. Up/down testeados, drift check limpio.

**`RefreshTokenService`** (`apps/api/src/modules/auth/refresh-token.service.ts`):

- `issue({ userId, tenantId, userAgent, ip })`: genera 64 bytes random base64url (~86 chars), hashea con SHA-256 (64 chars hex) y persiste. Devuelve el plano + `expiresAt` (30d). El plano nunca se persiste ni se loggea.
- `rotate({ presentedToken, userAgent, ip })`: busca por hash. Si no existe / expirado → 401 genérico. Si **ya estaba revocado** → reuse detection: revoca todos los refresh activos del user, loggea con `Logger` de NestJS (sin volcar el token) y tira 401. Si OK → revoca el viejo, crea el nuevo, setea `replaced_by` del viejo apuntando al nuevo. Devuelve `{ token, expiresAt, userId, tenantId }`.
- `revoke(presentedToken)`: marca `revoked_at` por hash. No-op si no existe o ya está revocado (no se filtra existencia).
- `revokeAllForUser(userId)`: marca `revoked_at` en todos los activos del user. Usado por `change-password`, `logout-all` y reuse detection. Constantes en `refresh-token.constants.ts` (`REFRESH_TOKEN_BYTES=64`, `REFRESH_TOKEN_TTL_MS=30d`, `REFRESH_COOKIE_NAME`).

**Endpoints** (`auth.controller.ts`):

- `POST /auth/login` y `POST /auth/student-login`: además del access JWT, devuelven `refreshToken` + `refreshTokenExpiresAt` (ISO) en el body **y** setean cookie `rutinex_refresh` httpOnly.
- `POST /auth/refresh` (@Public): lee el refresh del body o de la cookie (body prioritario, ver ADR-017). Rota vía `RefreshTokenService.rotate`, luego verifica que `user.isActive` y, si tiene tenant, que `tenant.isActive` — ante cualquier falla revoca el refresh recién emitido y devuelve 401 genérico (no se filtra `USER_INACTIVE` / `TENANT_INACTIVE` desde el refresh). Setea cookie nueva.
- `POST /auth/logout` (bearer): revoca el refresh del body o cookie. Idempotente: 204 aunque el token no exista o ya esté revocado. Limpia cookie.
- `POST /auth/logout-all` (bearer): revoca todos los refresh activos del `req.user.userId`. Limpia cookie. 204.
- `POST /auth/change-password`: el flow del Step 8 sigue igual, pero ahora **revoca todos los refresh tokens del user** en ambos modos (forzado y voluntario), cerrando el TODO sembrado en Step 8. Limpia cookie.

**Cookie httpOnly** (ADR-017): helper `apps/api/src/modules/auth/refresh-cookie.ts` con `setRefreshCookie`, `clearRefreshCookie` y `extractRefreshToken(body, cookies)`. Cookie config: `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `secure: NODE_ENV === 'production'`, `domain: process.env.REFRESH_COOKIE_DOMAIN || undefined`, `expires: refresh.expiresAt`. `cookie-parser` agregado a `apps/api` y registrado en `main.ts` + en el `beforeAll` del E2E. CORS de `main.ts` ahora con `credentials: true` para que el web pueda enviar la cookie cross-subdomain. `trust proxy=1` en prod para que `req.ip` venga del `X-Forwarded-For`.

**Helper nuevo en `TenantsService`**: `findByIdIncludingInactive(id)` — el refresh resuelve el tenant del user vía id (no slug). El `findBySlugIncludingInactive` previo se mantiene para el flow de login.

**Decisión**: ADR-017 "Refresh token: body + cookie httpOnly (acepta ambos)" — registra que el server soporta los dos transportes, con el body como prioridad para simplificar mobile/PWA/tests sin sacrificar el XSS-hardening del web.

**Tests**:

- Unit (`refresh-token.service.spec.ts`, 11 cases): issue (token base64url, hash SHA-256, tenant_id nullable, tokens nunca se repiten), rotate (OK, 401 si no existe, reuse detection revoca todos, 401 si expirado), revoke (marca + no-op), revokeAllForUser.
- Unit (`auth.service.spec.ts`, 23 cases reescritos): los tests previos pasaron a recibir `ctx` y ahora verifican `refreshTokenService.issue`. Sumados los del refresh (OK tenant + SUPERADMIN, 401 + revoca-nuevo si user pausado / tenant pausado / user inexistente, propaga 401 cuando rotate falla), logout / logout-all, y change-password ahora también verifica `revokeAllForUser` en ambos modos.
- E2E (`auth.e2e-spec.ts`, +13 nuevos = 54 totales): login devuelve `refreshToken` + cookie httpOnly httpOnly/samesite=lax con el mismo valor; `refresh_tokens` row persiste `tenant_id` correcto (NULL para SUPERADMIN); rotación end-to-end (viejo deja de servir); reuse detection (rotar, rotar de nuevo el viejo → 401 + el segundo refresh también queda inválido); refresh con cookie pura sin body; refresh sin token → 401; refresh con user pausado → 401; logout revoca + idempotente; logout sin bearer → 401; logout-all mata todas las sesiones; change-password forzado y voluntario revocan todos los refresh activos del user.

Archivos clave: `apps/api/src/modules/auth/entities/refresh-token.entity.ts`, `apps/api/src/migrations/1779200000000-InitRefreshTokens.ts`, `apps/api/src/modules/auth/{refresh-token.service,refresh-token.constants,refresh-cookie,auth.service,auth.controller,auth.module,jwt-auth.guard}.ts` + sus `*.spec.ts`, `apps/api/src/modules/auth/dto/refresh.dto.ts`, `apps/api/src/modules/tenants/tenants.service.ts` (`findByIdIncludingInactive`), `apps/api/src/main.ts` (cookieParser + CORS credentials + trust proxy), `apps/api/test/auth.e2e-spec.ts`, `apps/api/.env.example` (`REFRESH_COOKIE_DOMAIN`), `docs/04-auth.md`, `docs/05-api-conventions.md`, `docs/08-decisiones.md` (ADR-017).

Verificación: `pnpm lint` clean en root. `pnpm --filter @rutinex/api test` 106/106 (94 previos + 12 nuevos en refresh-token-service + tests reescritos de auth-service). `pnpm --filter @rutinex/api test:e2e` 54/54 (41 previos + 13 nuevos del Step 9).

Notas:

- `expires_at` quedó como `timestamptz` con índice (`ix_refresh_tokens_expires_at`) para que la limpieza futura de tokens expirados sea barata (cron en Step 30 quizá; no se agendó todavía).
- El JWT del access **no** se revoca cuando se revoca el refresh — sigue funcionando hasta su `exp` (15min). Es deliberado: el frontend mata la sesión al recibir 401 en `/auth/refresh`, no antes. Si en el futuro queremos un access blacklist más agresivo, sumamos un set in-memory; por ahora 15min es aceptable.
- El reuse detection loggea con `Logger.warn` el `userId` y el `id` del row del refresh reusado — nunca el token plano ni el hash (el hash tampoco es sensible, pero no aporta nada al logs).
- `req.ip` en E2E llega como `::ffff:127.0.0.1` (IPv6-mapped IPv4 de supertest); por eso `ip` en la entity es `varchar(45)` (IPv6 cabe en 39, redondeado).
- El handler `change-password` ahora llama `clearRefreshCookie(res)` después del revoke-all (la sesión del browser queda forzada al re-login), pero el body sigue siendo 204 sin body. El frontend tiene que loguear de nuevo después.

### Step 10 — Multi-tenancy guards + TenantScopedRepository (2026-05-17)

`TenantGuard` global validando `x-tenant-slug` contra el JWT, `TenantScopedRepository` blindando queries sin `tenant_id`, decoradores `@TenantId()` y `@SkipTenantGuard()`, refactor del `UsersService` para usar el wrapper con escape hatches explícitos. Sin endpoints nuevos en `src/` — el controller sintético para tests vive sólo en el spec E2E.

**`TenantScopedRepository<T>`** en `apps/api/src/common/repository/tenant-scoped.repository.ts`: extiende `Repository<T>` (TypeORM) y devuelve `Promise.reject(Error)` en `find`, `findOne`, `findBy`, `findOneBy`, `count`, `countBy`, `update`, `delete` cuando el `where`/`criteria` no incluye `tenantId` ni `tenant_id`. Para arrays (OR), exige que **todos** los brazos filtren por tenant (un brazo sin filtro filtra todo). Tira `Error` plano (no `HttpException`) para que el filtro global no lo transforme — es un bug de programación, queremos stack trace ruidoso.

Escape hatches con sufijo `AcrossTenants` (`findAcrossTenants`, `findOneAcrossTenants`, `countAcrossTenants`, `updateAcrossTenants`, `deleteAcrossTenants`, `saveAcrossTenants`): no chequean tenant. El nombre largo es deliberado (warning visual en code review). Ver ADR-018.

**`UsersRepository`** (`apps/api/src/modules/users/users.repository.ts`): `@Injectable()` que extiende `TenantScopedRepository<User>` con el constructor estándar de TypeORM 0.3 (`super(User, dataSource.createEntityManager())`). Registrado en `UsersModule.providers` y consumido por `UsersService` reemplazando el `@InjectRepository(User)` previo. `UsersService` ahora usa los escape hatches explícitamente: `findById` → `findOneAcrossTenants`, `setActive/setMustChangePassword/setPassword` → `updateAcrossTenants` (todos los updates son por id, el caller validó autorización antes).

**`TenantGuard`** (`apps/api/src/modules/auth/tenant.guard.ts`): guard global registrado vía `APP_GUARD` después del `JwtAuthGuard` en `AuthModule.providers` (el orden de NestJS respeta el orden de registración — Jwt primero, Tenant después). Skipea (en este orden):

1. `@Public()` — endpoints sin auth.
2. Path `/superadmin/*` (chequeo: `path === '/superadmin' || path.startsWith('/superadmin/')` — `'/superadminish'` NO matchea).
3. `@SkipTenantGuard()` — endpoints autenticados sin contexto de tenant.

Para el resto: exige header `x-tenant-slug`, lo normaliza (`trim().toLowerCase()`), busca `TenantsService.findBySlugIncludingInactive(slug)`. Si no resuelve a un tenant cuyo `id` matchee `req.user.tenantId` → 403 `TENANT_MISMATCH` (colapsa "slug inexistente" + "slug de otro tenant" para no filtrar existencia, ADR-018). Si matchea pero `tenant.isActive=false` → 403 `TENANT_INACTIVE` (igual que en login). Si no llega header → 400 `TENANT_SLUG_REQUIRED`.

**Decoradores nuevos**:

- `@SkipTenantGuard()` (`skip-tenant-guard.decorator.ts`): meta key `'skipTenantGuard'`. Ortogonal a `@Public()` — éste skipea ambos guards globales; aquél sólo el `TenantGuard`. Aplicado a nivel **clase** en `AuthController` (todas las rutas de auth son cross-tenant por diseño: login resuelve por host, refresh/logout/change-password operan sobre el JWT del user).
- `@TenantId()` (`tenant-id.decorator.ts`): `createParamDecorator` que devuelve `req.user.tenantId` (string no-null). Si no hay tenant en el JWT (típicamente porque un SUPERADMIN tocó por error una ruta tenant-scoped — el `TenantGuard` ya debería haber tirado 403 antes, pero defensive), tira 401 `INVALID_CREDENTIALS`.

**Sin endpoints nuevos en `src/`**. El test E2E del guard usa un **controller sintético** definido directamente en `apps/api/test/tenant-guard.e2e-spec.ts` (`@Controller('test-tenant-guard') class TenantScopedTestController { @Get('me') me(@TenantId() tenantId) { return { tenantId }; } }`) wrapeado en un `TestAppModule` que importa `AppModule` y suma el controller. Step 12 (CRUD users) es el primer endpoint real tenant-scoped.

**`TenantsService` y `RefreshTokenService` no se refactorizan**: `tenants` no tiene `tenant_id` (es la tabla raíz); `refresh_tokens` lo tiene pero todas sus queries son por `token_hash` o `user_id` (no por tenant). Forzar escape hatches en cada query sería ceremonia sin valor. El wrapper aplica a tablas donde el **caso común** es tenant-scoped — `users` (la mayoría de los lookups son por `(tenant_id, email|dni)`), y en el futuro `exercises`, `routines`, etc.

**Códigos de error nuevos** (documentados en `docs/05-api-conventions.md`):

- 400 `TENANT_SLUG_REQUIRED` — `TenantGuard` sin header.
- 403 `TENANT_MISMATCH` — slug no resuelve al tenant del JWT (colapsa inexistente + ajeno).

**Tests**:

- Unit (`tenant-scoped.repository.spec.ts`, 19 cases): rechaza find/findOne/findBy/findOneBy/count/countBy/update/delete sin tenantId (cada uno verificado que NO delega a super); acepta con tenantId (delega correctamente); OR rechaza si un brazo no filtra (incluido array vacío); IsNull() en tenantId vale como filtro; los 5 escape hatches no chequean. Spies sobre `Repository.prototype` para no necesitar una DataSource real.
- Unit (`tenant.guard.spec.ts`, 13 cases): skip rules (Public, SkipTenantGuard, /superadmin exactamente y con subpath, NO /superadminish); validación (401 sin user, 400 sin slug, 400 con slug vacío, 403 MISMATCH si el slug no existe, 403 MISMATCH si pertenece a otro tenant, 403 INACTIVE si matchea pero pausado, 200 si matchea y activo, SUPERADMIN → 403 MISMATCH, normalización case-insensitive + trim del slug).
- Unit (`users.service.spec.ts`, +5 cases): findById ahora usa `findOneAcrossTenants`; setActive/setMustChangePassword/setPassword usan `updateAcrossTenants`. Resto de los casos del Step 5 no regresionan.
- E2E (`tenant-guard.e2e-spec.ts`, 12 cases): controller sintético en el fixture. OWNER de A con slug=A → 200 + el tenantId del JWT en el body; OWNER de A con slug=B → 403 MISMATCH; OWNER de A con slug inexistente → 403 MISMATCH (sin filtrar); OWNER de A con slug=A pero tenant pausado mid-request → 403 INACTIVE; SUPERADMIN tocando ruta tenant-scoped → 403 MISMATCH; SUPERADMIN tocando `/superadmin/ping` sin slug → 200 (skip por path); `/auth/change-password` (autenticado, sin slug) → respuesta del handler (no TENANT_SLUG_REQUIRED, confirma que `@SkipTenantGuard` corta antes); `/tenants/by-slug` (@Public) y `/` (@Public) → 200 sin nada. Sin Authorization → 401 (JwtAuthGuard corre antes).

**Decisión**: ADR-018 "Tenant scoping: `TenantGuard` global + `TenantScopedRepository`" — registra (1) las tres categorías de skip y por qué `@SkipTenantGuard` es ortogonal a `@Public`; (2) el colapso `TENANT_MISMATCH` entre inexistente y ajeno; (3) el patrón del wrapper extendiendo `Repository<T>` con escape hatches `AcrossTenants`; (4) por qué `tenants`/`refresh_tokens` no usan el wrapper.

Archivos clave: `apps/api/src/common/repository/{tenant-scoped.repository,tenant-scoped.repository.spec}.ts`, `apps/api/src/modules/auth/{tenant.guard,tenant.guard.spec,skip-tenant-guard.decorator,tenant-id.decorator,auth.module,auth.controller}.ts`, `apps/api/src/modules/users/{users.repository,users.module,users.service,users.service.spec}.ts`, `apps/api/test/tenant-guard.e2e-spec.ts`, `docs/05-api-conventions.md` (tabla de codes), `docs/08-decisiones.md` (ADR-018), `docs/09-progreso.md`.

Verificación: `pnpm lint` clean en root. `pnpm --filter @rutinex/api test` 146/146 (106 previos del Step 9 + 19 nuevos en tenant-scoped-repository + 13 nuevos en tenant-guard + 5 nuevos en users-service + 3 sumados del test de setPassword/find by id de UsersService que antes no estaban). `pnpm --filter @rutinex/api test:e2e` 66/66 (54 previos + 12 nuevos del tenant-guard).

Notas:

- El controller sintético `test-tenant-guard` vive **sólo** en el spec E2E — no contamina `src/`. Cuando entren los CRUD reales (Step 12), pueden borrarse esos tests (el guard queda cubierto por los E2E de los endpoints reales) o dejarse como red de seguridad básica.
- `req.path` en `TenantGuard` lee el path **antes** de cualquier rewrite. Nest/Express lo expone con el formato `/foo/bar` (sin query). El chequeo `path.startsWith('/superadmin/')` es robusto contra trailing slashes (NestJS los normaliza).
- El wrapper no protege queries con `createQueryBuilder()` ni `repo.query('SELECT ...')`. La convención sigue siendo "nunca tirar SQL sin `WHERE tenant_id` salvo justificación explícita". Si el riesgo crece, sumamos un linter custom.
- El refactor de `UsersService` cambió la inyección: antes `@InjectRepository(User) repo: Repository<User>`; ahora `UsersRepository` como provider concreto en `UsersModule`. Los tests del service pasaron de mockear via `getRepositoryToken(User)` a mockear via `UsersRepository`. Sin cambios funcionales — sólo de cableado.

### Step 11 — Roles y guard de roles (2026-05-17)

`RolesGuard` global, decorador `@Roles(...)` y código de error `FORBIDDEN_ROLE`. SUPERADMIN bypassa (ADR-019). Sin endpoints reales en `src/` — el controller sintético vive sólo en el spec E2E (mismo patrón que Step 10).

**Decorador `@Roles(...)`** en `apps/api/src/modules/auth/roles.decorator.ts`: `SetMetadata(ROLES_KEY, roles)` con `ROLES_KEY = 'roles'`. Acepta una o más entradas de `UserRole` (`'OWNER' | 'TRAINER' | 'STUDENT'`). Si no se aplica, el guard no exige rol — el endpoint queda abierto a cualquier user autenticado del tenant (ADR-019).

**`RolesGuard`** en `apps/api/src/modules/auth/roles.guard.ts`:

- Skipea `@Public()` (consistente con `TenantGuard`).
- Skipea cuando no hay meta `@Roles` (handler ni clase) o cuando es un array vacío — endpoint sin gate por rol.
- 401 defensivo si no hay `req.user` (bug de orden de guards).
- SUPERADMIN bypassa (`req.user.isSuperadmin === true` → true). En la práctica el `TenantGuard` (Step 10) lo bloquea antes con `TENANT_MISMATCH` en rutas tenant-scoped; el bypass cubre rutas `@SkipTenantGuard()` con `@Roles(...)` y defensa en profundidad. Ver ADR-019.
- Si `req.user.role` ∈ lista permitida → 200; si no → **403 `FORBIDDEN_ROLE`**.

**Registración global** en `AuthModule.providers` como `APP_GUARD` después de `JwtAuthGuard` y `TenantGuard`. Orden final: `JwtAuthGuard` → `TenantGuard` → `RolesGuard` (NestJS respeta el orden de registración). También exportado para tests que lo quieran inyectar localmente.

**Códigos de error nuevos** (documentados en `docs/05-api-conventions.md`):

- 403 `FORBIDDEN_ROLE` — el `role` del JWT no matchea la lista permitida por `@Roles`.

**Tests**:

- Unit (`roles.guard.spec.ts`, 11 cases): skip por `@Public`, skip sin meta `@Roles`, skip con meta vacía, SUPERADMIN bypassa aunque el rol no esté en la lista, OWNER/TRAINER pasan con sus respectivas listas, STUDENT con `@Roles('OWNER')` → 403, TRAINER con `@Roles('OWNER')` → 403, 401 sin `user`, user con `role=null` y no-superadmin → 403 (caso defensivo imposible pero cubierto), handler-level override (Reflector.getAllAndOverride pone handler primero).
- E2E (`roles-guard.e2e-spec.ts`, 15 cases): controller sintético `RolesTestController` con 6 endpoints (`/any` sin `@Roles`, `/owner-only`, `/trainer-only`, `/student-only`, `/staff` con dos roles, y `/owner-only-cross-tenant` con `@SkipTenantGuard + @Roles('OWNER')` para probar el SUPERADMIN bypass). Cubre cada cruce de role × endpoint relevante + el caso SUPERADMIN en ruta tenant-scoped (cae en `TENANT_MISMATCH` del Step 10, no llega al `RolesGuard`) y en ruta `@SkipTenantGuard` (bypassa con 200).

**Decisión**: ADR-019 "Roles: `RolesGuard` global + SUPERADMIN bypass" — registra (1) sin `@Roles` el endpoint queda abierto a cualquier user autenticado del tenant (la default es "no gatear", no "denegar"), (2) SUPERADMIN bypassa por consistencia con "operador con permisos plenos", aunque en la práctica el `TenantGuard` lo bloquea antes en rutas tenant-scoped.

Archivos clave: `apps/api/src/modules/auth/{roles.decorator,roles.guard,roles.guard.spec,auth.module}.ts`, `apps/api/test/roles-guard.e2e-spec.ts`, `docs/05-api-conventions.md` (tabla de codes), `docs/08-decisiones.md` (ADR-019).

Verificación: `pnpm lint` clean en root. `pnpm --filter @rutinex/api test` 157/157 (146 previos del Step 10 + 11 nuevos en roles-guard). `pnpm --filter @rutinex/api test:e2e` 81/81 (66 previos + 15 nuevos del roles-guard).

Notas:

- El controller sintético `test-roles-guard` vive sólo en el spec E2E — patrón heredado de Step 10. Cuando entren los CRUD reales con `@Roles` (Step 12+), pueden borrarse o dejarse como red de seguridad.
- `Reflector.getAllAndOverride([handler, class])` pone el handler primero — así un `@Roles` a nivel handler **gana** sobre un `@Roles` a nivel clase. No es "merge": es "override", lo cual es lo esperable (si declaro a nivel handler, sobreescribo la default de la clase).
- El guard tira `ForbiddenException` con `code` parseable. El filtro global (`HttpExceptionFilter`) propaga el `code` al body. Sin diferenciación entre "no tiene rol" y "rol no matchea" — el caller siempre ve `FORBIDDEN_ROLE`.

## Próxima acción concreta

Step 12 — CRUD: Users del tenant. OWNER crea TRAINER (password generada `must_change_password=true`); TRAINER crea STUDENT (sin password, DNI requerido). `POST /users/:id/reset-password` (OWNER → TRAINER del mismo tenant, revoca refresh tokens). `GET /users` con filtros + paginación offset. `PATCH /users/:id` (nombre, isActive). `DELETE /users/:id` (soft delete). Primer módulo con `@Roles` real + ese repositorio usando `TenantScopedRepository`. Ver criterios completos en `docs/07-roadmap.md` → Step 12.

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
