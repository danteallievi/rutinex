# 07 — Roadmap

Pasos numerados, ordenados, con criterios de aceptación claros. Se trabaja **un paso a la vez**. Al terminar un paso se actualiza `docs/09-progreso.md` y se hace commit.

---

## Fase 0 — Setup del repo

### Step 1 — Monorepo skeleton

**Objetivo**: estructura base con pnpm workspaces.

**Hacer**:

- `package.json` raíz con `workspaces: ["apps/*", "packages/*"]`, `pnpm-workspace.yaml`.
- `apps/api/` con `nest new` (sin git).
- `apps/web/` con `create-next-app` (TypeScript, Tailwind, App Router, src=no, eslint sí).
- `packages/shared-types/` con `package.json` mínimo y `tsconfig.json`.
- `.gitignore`, `.editorconfig`, `.nvmrc` (Node 22).
- `tsconfig.base.json` en raíz con paths compartidos.
- `pnpm install` corre limpio.

**Criterio**: `pnpm --filter api start:dev` levanta el "Hello World" de Nest. `pnpm --filter web dev` levanta la página default de Next.

---

### Step 2 — Linting, formatting, hooks

**Objetivo**: ESLint + Prettier compartidos, husky + lint-staged.

**Hacer**:

- ESLint config raíz compartida (`@typescript-eslint`).
- Prettier config raíz.
- Husky con pre-commit que corra lint-staged sobre staged files.
- `pnpm lint` y `pnpm format` desde raíz.

**Criterio**: `pnpm lint` corre limpio. Un commit con un archivo desformateado se autoformatea via lint-staged.

---

## Fase 1 — Backend foundations

### Step 3 — Conexión a DB + primera entity

**Objetivo**: API conecta a Postgres local y crea la primera tabla.

**Hacer**:

- `docker-compose.yml` en raíz con Postgres 16.
- TypeORM config en `apps/api/src/config/database.ts`. Lee de env.
- Entity `Tenant` (mínima: id, slug, name, branding, is_active, timestamps).
- Migración inicial generada y aplicada.
- Script `pnpm --filter api db:up`, `db:down`, `migration:generate`, `migration:run`, `migration:revert`.

**Criterio**: `pnpm --filter api migration:run` deja la DB con la tabla `tenants`. Un query de prueba la lee vacía.

---

### Step 4 — Módulo Tenants + resolución por slug

**Objetivo**: CRUD básico de tenant y endpoint para resolver tenant por slug.

**Hacer**:

- `TenantsModule`, `TenantsService`, `TenantsController`.
- `POST /tenants` (sin auth todavía, lo abrimos para signup en step 7).
- `GET /tenants/by-slug/:slug` → devuelve `{ id, slug, name, branding }` (público, sin datos sensibles).
- Validación de slug con regex y reservados (ver `docs/03-multi-tenancy.md`).

**Criterio**: tests unitarios del service. E2E que crea, lee por slug, rechaza slug reservado.

---

### Step 5 — Entity User + módulo Users

**Objetivo**: tabla `users` y CRUD interno.

**Hacer**:

- Entity `User` con todos los campos de `docs/02-dominio.md`.
- Migración.
- `UsersModule` con service. **Sin endpoints públicos** todavía; lo va a usar `auth`.
- Helpers: `findByEmailAndTenant`, `create`, `setActive`.

**Criterio**: unit tests del service. Constraint UNIQUE de `(tenant_id, email)` verificado en test.

---

### Step 6 — Argon2 + helpers de password

**Objetivo**: hashear y verificar passwords.

**Hacer**:

- `apps/api/src/modules/auth/password.service.ts` con `hash` y `verify`.
- Params Argon2id según `docs/04-auth.md`.
- Unit tests: roundtrip, rechazo de password incorrecta.

**Criterio**: tests verdes.

---

### Step 7 — Auth: signup OWNER + tenant

**Objetivo**: endpoint público que crea tenant + OWNER en una transacción.

**Hacer**:

- `POST /auth/signup` con DTO (slug, tenantName, email, password, firstName, lastName).
- Validación: slug disponible, email no duplicado dentro de un tenant nuevo (irrelevant), password fuerte.
- Crear `tenant` (status `trial`) + `user` (OWNER) en una transacción.
- Devolver `{ tenant: {...}, user: {...}, accessToken: null }` (login viene en step 8, no auto-login).

**Criterio**: E2E que signup crea ambos, slug duplicado rechaza, password débil rechaza.

---

### Step 8 — Auth: login + JWT access token

**Objetivo**: login emite access token. Sin refresh todavía.

**Hacer**:

- `POST /auth/login`. Resolución de tenant según `docs/04-auth.md` flujo Login.
- Passport `LocalStrategy` + `JwtStrategy`.
- `JwtAuthGuard` global con decorador `@Public()`.
- `JWT_ACCESS_SECRET` en env.
- Token TTL 15min.

**Criterio**: E2E login devuelve token, token rechazado tras 15min (test con clock fake), token inválido → 401, password incorrecta → 401 genérico.

---

### Step 9 — Auth: refresh tokens + rotación + detección de reuso

**Objetivo**: refresh tokens completos.

**Hacer**:

- Entity `RefreshToken` y migración.
- `POST /auth/refresh` con rotación.
- `POST /auth/logout` y `POST /auth/logout-all`.
- Detección de reuso: si llega un refresh ya revocado, revocar todos los del user.
- Cookie httpOnly secure SameSite=Lax con scope `.rutinex.app` para el refresh.

**Criterio**: E2E completo del flujo refresh, logout, logout-all, reuso.

---

### Step 10 — Multi-tenancy guards + TenantScopedRepository

**Objetivo**: ninguna query toca DB sin `tenant_id` filtrado.

**Hacer**:

- `TenantGuard` global que valida `x-tenant-slug` vs JWT.
- Decorador `@TenantId()`.
- Clase base `TenantScopedRepository<T>` que rechaza queries sin tenant_id (al menos los métodos comunes: find, findOne, count, update, delete).
- Refactor de services existentes para usarla.

**Criterio**: E2E cross-tenant: user de tenant A no puede leer/modificar nada del B (devuelve 404, no 403, para no filtrar existencia). Test unit del TenantScopedRepository.

---

### Step 11 — Roles y guard de roles

**Objetivo**: control de acceso por rol.

**Hacer**:

- Decorador `@Roles('OWNER', 'TRAINER', 'STUDENT')`.
- `RolesGuard` global.
- Endpoint dummy protegido por rol para test.

**Criterio**: E2E: STUDENT no puede hacer un POST que requiere TRAINER, etc.

---

### Step 12 — CRUD: Users del tenant (alta de TRAINER y STUDENT)

**Objetivo**: OWNER crea trainers, TRAINER crea students.

**Hacer**:

- `POST /users` (OWNER → puede crear TRAINER y STUDENT; TRAINER → solo STUDENT bajo su `trainer_id`).
- `GET /users` con filtros (`role`, `isActive`, paginación).
- `PATCH /users/:id` (cambiar nombre, `isActive`).
- `DELETE /users/:id` (soft delete).
- Validación de DNI (obligatorio para STUDENT).
- Password generada en creación, devuelta una vez.

**Criterio**: E2E completo. Trainer no puede listar users de otro trainer del mismo tenant (filtrado).

---

### Step 13 — CRUD: Exercises

**Objetivo**: ejercicios del tenant.

**Hacer**:

- Entity + migración.
- CRUD completo. Solo OWNER y TRAINER pueden crear/editar/borrar. STUDENT puede leer.
- Validación de URL de media.
- Endpoint `GET /exercises` con búsqueda por título y filtro por `muscle_groups`.

**Criterio**: E2E.

---

### Step 14 — Storage de media (R2)

**Objetivo**: subir gifs/videos de ejercicios a Cloudflare R2.

**Hacer**:

- Bucket en R2 (manual, una vez). Credenciales en env.
- `POST /media/upload-url` que devuelve una presigned URL para PUT directo desde el cliente.
- `POST /media/confirm` para asociar el archivo subido a un exercise.
- Límite de tamaño: 50MB para videos, 10MB para gifs, 5MB para imágenes.
- Validación de mime type en confirm.

**Criterio**: E2E manual con curl + frontend de prueba.

---

### Step 15 — CRUD: Routines + RoutineItems

**Objetivo**: armar rutinas con ejercicios ordenados.

**Hacer**:

- Entities + migración.
- `POST /routines` con items embebidos.
- `PATCH /routines/:id` (reordenar items, agregar, quitar).
- `GET /routines/:id` con items y ejercicios resueltos.

**Criterio**: E2E. Reordenar funciona.

---

### Step 16 — Asignación de rutina a alumno

**Objetivo**: vincular rutina con alumno.

**Hacer**:

- Entity `Assignment` + migración.
- `POST /routines/:id/assignments` con `studentId`, `startsOn`, `endsOn?`, `weekdayMask`.
- `GET /students/:id/assignments` (activas y vencidas).
- `DELETE /assignments/:id`.

**Criterio**: E2E. Trainer no puede asignar a alumno de otro trainer (a evaluar: por ahora lo dejamos restringido).

---

### Step 17 — Sesión + tracking de sets

**Objetivo**: el alumno ejecuta una rutina.

**Hacer**:

- Entities `Session`, `Set` + migración.
- `GET /sessions/today` (STUDENT): resuelve qué asignación aplica hoy.
- `POST /sessions` (STUDENT): inicia sesión, snapshot de rutina.
- `POST /sessions/:id/sets` (STUDENT): registra un set.
- `POST /sessions/:id/complete` (STUDENT): marca completada.
- `GET /sessions` con filtros (rango de fechas, studentId si TRAINER).

**Criterio**: E2E completo.

---

### Step 18 — Personal Records

**Objetivo**: derivar y consultar PRs.

**Hacer**:

- Entity `PersonalRecord` + migración.
- Cálculo dentro de la transacción de "POST /sets": si supera, upsert.
- `GET /students/:id/personal-records` y `GET /students/:id/personal-records/:exerciseId`.

**Criterio**: E2E. Concurrencia: dos POST de set simultáneos no rompen el PR (test con jest + transacción).

---

### Step 19 — Comments

**Objetivo**: comentarios del alumno en ejercicios/sesiones.

**Hacer**:

- Entity + migración.
- `POST /comments`, `GET /comments` filtrable.
- Solo el dueño puede borrar el suyo.

**Criterio**: E2E.

---

## Fase 2 — Frontend foundations

### Step 20 — Setup base del frontend

**Objetivo**: middleware de subdominios, layouts de las 3 superficies, shadcn instalado.

**Hacer**:

- `middleware.ts` con detección de host (ver `docs/03-multi-tenancy.md`).
- Route groups `(marketing)`, `(admin)`, `(student)` con layouts placeholder.
- shadcn/ui inicializado.
- `lib/api-client.ts` con baseUrl desde env.
- Página landing mínima en `/`.

**Criterio**: localhost funciona. `localhost:3000` muestra landing, `app.localhost:3000` admin placeholder, `cualquier.localhost:3000` student placeholder.

---

### Step 21 — Auth en frontend (todas las superficies)

**Objetivo**: login y refresh silencioso.

**Hacer**:

- Store de auth con Zustand (access token en memoria).
- `useAuth()` hook.
- Páginas: `/(marketing)/signup`, `/(admin)/login`, `/(student)/login`.
- Refresh silencioso al cargar la app.
- Redirect a login si protected route sin auth.

**Criterio**: signup + login funcional contra el API. Refresh tras 15min funciona.

---

### Step 22 — Panel admin: alumnos

**Objetivo**: OWNER/TRAINER ven y gestionan alumnos.

**Hacer**:

- `/(admin)/students` con lista paginada.
- `/(admin)/students/new` con form.
- `/(admin)/students/:id` con detalle y toggle activo/inactivo.

**Criterio**: flujo completo en mobile y desktop.

---

### Step 23 — Panel admin: ejercicios y rutinas

**Objetivo**: CRUD desde frontend.

**Hacer**:

- `/(admin)/exercises` lista, crear, editar.
- Subida de media con presigned URL (step 14).
- `/(admin)/routines` lista, builder con drag&drop de items.

**Criterio**: TRAINER puede armar una rutina con 5 ejercicios y subir un gif.

---

### Step 24 — Panel admin: asignaciones

**Objetivo**: asignar rutina a alumno desde UI.

**Hacer**:

- En `/(admin)/students/:id`, tab "Rutinas".
- Picker de rutina + fechas + días de la semana.

**Criterio**: TRAINER asigna y el STUDENT la ve.

---

### Step 25 — App del student: home, sesión, tracking

**Objetivo**: alumno entra, ve la rutina del día, la ejecuta.

**Hacer**:

- `/(student)/` home con "Hoy".
- Tap en ejercicio → vista de detalle con video/gif, descripción.
- Tracking de sets inline.
- Botón "Completar sesión".
- Branding aplicado desde el tenant.

**Criterio**: flujo end-to-end completo. Un alumno puede entrenar una sesión real.

---

### Step 26 — App del student: histórico y PRs

**Objetivo**: el alumno ve su progreso.

**Hacer**:

- `/(student)/history` con sesiones pasadas.
- `/(student)/exercises/:id` con histórico por ejercicio y PR.

**Criterio**: el alumno ve su evolución.

---

## Fase 3 — Producción

### Step 27 — Deploy

**Objetivo**: producción mínima.

**Hacer**:

- DNS con wildcard.
- API en Railway o Fly.
- Web en Vercel.
- Postgres en Neon.
- R2 ya configurado en step 14.
- Variables de entorno seteadas en cada plataforma.
- Smoke test post-deploy.

**Criterio**: signup desde `rutinex.app`, login, crear alumno, ejecutar sesión, todo en prod.

---

### Step 28 — Observabilidad mínima

**Objetivo**: saber cuándo algo se rompe.

**Hacer**:

- Sentry free tier en api y web.
- Healthcheck endpoint público.
- Uptime monitor gratis (Better Stack / UptimeRobot).

**Criterio**: rompemos algo a propósito y nos enteramos.

---

## Fase 4 — Cosas que vienen después

Sin numerar todavía. Cuando alguna de estas se priorice, se vuelve un step numerado.

- Billing real (MercadoPago para AR).
- Invitación de alumno por email/WhatsApp con link mágico.
- Comentarios visibles al trainer + notifs.
- PWA (manifest + service worker, install prompt).
- Catálogo de ejercicios global compartido.
- Mediciones corporales (peso, perímetros).
- Plan nutricional.
- Reportes para el trainer (alumnos activos, sesiones por semana).
- 2FA para trainers.
- Dashboard del OWNER con métricas del negocio.
