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
- `POST /tenants` (sin auth todavía; en Step 13 se mueve bajo `/superadmin/tenants` con `SuperadminGuard`).
- `GET /tenants/by-slug/:slug` → devuelve `{ id, slug, name, branding }` (público, sin datos sensibles).
- Validación de slug con regex y reservados (ver `docs/03-multi-tenancy.md`).

**Criterio**: tests unitarios del service. E2E que crea, lee por slug, rechaza slug reservado.

---

### Step 4.5 — Interludio visual: multi-tenancy en pantalla

**Objetivo**: meter una mini-superficie web encima de lo que tenemos para ver el flujo multi-tenant funcionando antes de seguir con backend puro. No está en el plan original (la fase 2 era el frontend), pero queremos visceralidad temprana. Adelanta lo mecánico del Step 21 sin tocar auth.

**Hacer**:

- En `apps/api`: CORS habilitado para `localhost` y `*.localhost` en dev.
- En `apps/web`:
  - `lib/env.ts`, `lib/api-client.ts` con `createTenant` + `getTenantBySlug`, `lib/subdomain.ts` con `extractTenantSlug`.
  - `middleware.ts` que detecta subdominio y reescribe a `/t/:slug`. Reservados (`www`, `superadmin`) → no se tratan como tenant.
  - Landing en `/`: por ahora, hero + form de signup (usado solo durante Step 4.5 para probar `POST /tenants` en vivo). En Step 13 este form se elimina y la landing pasa a comercial con CTA WhatsApp.
  - Página del tenant en `app/t/[slug]/page.tsx`: server component que hace `GET /tenants/by-slug/:slug` y aplica `branding.primaryColor` como CSS var + muestra `logoUrl` si está.
  - `app/t/[slug]/not-found.tsx`: 404 cuando el slug no existe / `is_active=false`.
- `.env.example` actualizado con `NEXT_PUBLIC_API_URL`.

**Criterio**: en el navegador, `localhost:3000` muestra la landing; signup (provisional) crea el tenant y redirige; `<slug>.localhost:3000` muestra el nombre del gimnasio con el color primario aplicado; un slug inexistente muestra el 404.

> Nota: el form de signup de este step es **temporal** para validar el flujo end-to-end sin auth. El modelo definitivo es sales-led y el form se reemplaza por una landing comercial en Step 13 / Step 28. Ver ADR-012.

---

### Step 5 — Entity User + módulo Users

**Objetivo**: tabla `users` con superadmin y student-friendly desde el arranque.

**Hacer**:

- Entity `User` con todos los campos de `docs/02-dominio.md`, incluidos `is_superadmin`, `must_change_password`, `dni`, `password_hash` y `tenant_id` nullables a nivel tabla.
- Migración con:
  - UNIQUE `(tenant_id, email)` y UNIQUE `(tenant_id, dni)`.
  - Índice parcial único `CREATE UNIQUE INDEX users_email_global_unique ON users(email) WHERE tenant_id IS NULL` para SUPERADMINs.
- `UsersModule` con service. **Sin endpoints públicos** todavía; lo van a usar `auth` y `superadmin`.
- Helpers: `findByEmailAndTenant`, `findSuperadminByEmail`, `findStudentByDniAndTenant`, `create`, `setActive`, `setMustChangePassword`.
- Validación en service: si `role=STUDENT` → `dni` requerido y `password_hash` debe ser NULL; si `is_superadmin=true` → `tenant_id=NULL`, `role=NULL`, `password_hash` requerido.

**Criterio**: unit tests del service cubriendo cada constraint (UNIQUE compuesto, índice parcial, validaciones por rol).

---

### Step 6 — Argon2 + helpers de password

**Objetivo**: hashear y verificar passwords + generar passwords de sistema.

**Hacer**:

- `apps/api/src/modules/auth/password.service.ts` con `hash`, `verify`, y `generate()` (16 chars, alfabeto `[a-zA-Z0-9]` sin `0/O/o/1/l/I`, CSPRNG).
- Params Argon2id según `docs/04-auth.md`.
- Unit tests: roundtrip, rechazo de password incorrecta, `generate()` produce strings del largo y alfabeto esperados.

**Criterio**: tests verdes.

---

### Step 7 — Superadmin: schema + seed CLI + login básico

**Objetivo**: dejar el SUPERADMIN funcional end-to-end antes del login normal de tenant.

**Hacer**:

- Migración ya aplicada en Step 5 (este step solo construye encima de ella).
- Script CLI `pnpm --filter api seed:superadmin`: lee email + password por stdin, los valida, hashea con Argon2id, crea `user` con `is_superadmin=true`, `tenant_id=NULL`, `role=NULL`, `must_change_password=false`. Si ya existe un SUPERADMIN con ese email, falla con mensaje claro.
- `AuthModule` mínimo con `POST /auth/login` que **solo soporta el caso SUPERADMIN por ahora**: detecta host `superadmin.rutinex.app` (en dev, `superadmin.localhost`) o un header de override en tests; busca `user` por email con `is_superadmin=true`, valida password, emite access JWT con `{ sub, tenantId: null, role: null, isSuperadmin: true, iat, exp }`. Sin refresh todavía.
- `SuperadminGuard` que verifica `req.user.isSuperadmin === true` (todavía sin endpoints que lo usen — se prueba con un endpoint dummy en el test).
- `apps/api/scripts/README.md` documentando el script.

**Criterio**: E2E: seed crea el SUPERADMIN; login desde host `superadmin.*` devuelve JWT válido; login desde otro host con esas credenciales → `401 invalid credentials`; endpoint dummy con `SuperadminGuard` responde 200 con el JWT y 403 sin él.

---

### Step 8 — Auth: login de tenant + student-login + change-password + tenant inactive

**Objetivo**: completar el login para todos los roles asumiendo SUPERADMIN ya existente. Sin refresh todavía (eso es Step 9).

**Hacer**:

- `POST /auth/login` ahora también soporta hosts `<slug>.rutinex.app` (en dev, `<slug>.localhost`): resuelve `tenant_id` desde el slug; busca `user` por `(tenant_id, email)` con `is_superadmin=false`; emite JWT con `{ sub, tenantId, role, isSuperadmin: false, ... }`.
- `POST /auth/student-login` con `{ dni }`: solo válido en subdominios de tenant; busca `(tenant_id, dni, role='STUDENT')`; emite JWT con `role: 'STUDENT'`.
- Ambos endpoints rechazan `403 TENANT_INACTIVE` si `tenant.is_active=false`, y `403 USER_INACTIVE` si `user.is_active=false`.
- Ambos devuelven `user.mustChangePassword: boolean` en la response.
- `POST /auth/change-password`:
  - Forzado (`must_change_password=true`): input `{ newPassword }`; el JWT autentica; setea `must_change_password=false` y deja a los refresh tokens listos para revocación cuando exista esa tabla (Step 9).
  - Voluntario: input `{ currentPassword, newPassword }`; verifica `currentPassword` antes.
- Passport `LocalStrategy` + `JwtStrategy`.
- `JwtAuthGuard` global con decorador `@Public()`.
- `JWT_ACCESS_SECRET` en env. TTL 15min.

**Criterio**: E2E:

- Login OWNER por host de tenant → JWT con `role=OWNER`, `tenantId` resuelto.
- Login STUDENT por DNI → JWT con `role=STUDENT`.
- Cross-host (SUPERADMIN desde host de tenant; OWNER desde host SUPERADMIN) → 401 genérico.
- Tenant inactivo → 403 con code `TENANT_INACTIVE`.
- User inactivo → 403 con code `USER_INACTIVE`.
- Login con password generada → response `mustChangePassword=true`; `POST /auth/change-password { newPassword }` con ese JWT funciona; login subsiguiente con la nueva password → `mustChangePassword=false`.
- Modo voluntario: requiere `currentPassword`; sin ella → 400.

---

### Step 9 — Auth: refresh tokens + rotación + detección de reuso

**Objetivo**: refresh tokens completos.

**Hacer**:

- Entity `RefreshToken` y migración. `tenant_id` nullable (NULL para tokens de SUPERADMIN).
- `POST /auth/refresh` con rotación.
- `POST /auth/logout` y `POST /auth/logout-all`.
- Detección de reuso: si llega un refresh ya revocado, revocar todos los del user.
- `change-password` (forzado y voluntario) revoca todos los refresh tokens del user.
- Cookie httpOnly secure SameSite=Lax con scope `.rutinex.app` para el refresh.

**Criterio**: E2E completo del flujo refresh, logout, logout-all, reuso. Cambio de password fuerza re-login en otros devices.

---

### Step 10 — Multi-tenancy guards + TenantScopedRepository

**Objetivo**: ninguna query toca DB sin `tenant_id` filtrado (excepto SUPERADMIN explícito).

**Hacer**:

- `TenantGuard` global que valida `x-tenant-slug` vs JWT. Skipea rutas `/superadmin/*`.
- `SuperadminGuard` aplicado a controllers `/superadmin/*`.
- Decorador `@TenantId()`.
- Clase base `TenantScopedRepository<T>` que rechaza queries sin tenant_id (al menos los métodos comunes: find, findOne, count, update, delete).
- Refactor de services existentes para usarla.

**Criterio**: E2E cross-tenant: user de tenant A no puede leer/modificar nada del B (devuelve 404, no 403, para no filtrar existencia). Test unit del TenantScopedRepository. SUPERADMIN puede listar tenants sin `x-tenant-slug`.

---

### Step 11 — Roles y guard de roles

**Objetivo**: control de acceso por rol.

**Hacer**:

- Decorador `@Roles('OWNER', 'TRAINER', 'STUDENT')`.
- `RolesGuard` global. No aplica a rutas marcadas con `SuperadminGuard`.
- Endpoint dummy protegido por rol para test.

**Criterio**: E2E: STUDENT no puede hacer un POST que requiere TRAINER, etc.

---

### Step 12 — CRUD: Users del tenant (alta de TRAINER y STUDENT)

**Objetivo**: OWNER crea trainers, TRAINER crea students.

**Hacer**:

- `POST /users` (OWNER → puede crear TRAINER; TRAINER → puede crear STUDENT bajo su `trainer_id`):
  - TRAINER: password generada por el sistema, devuelta **una vez**, `must_change_password=true`.
  - STUDENT: sin password, `dni` obligatorio (validado en service), `must_change_password=false`.
- `POST /users/:id/reset-password` (OWNER → reset de TRAINER; no aplica a STUDENT): genera nueva password, devuelve una vez, setea `must_change_password=true`, revoca refresh tokens.
- `GET /users` con filtros (`role`, `isActive`, paginación).
- `PATCH /users/:id` (cambiar nombre, `isActive`).
- `DELETE /users/:id` (soft delete).

**Criterio**: E2E completo. Trainer no puede listar users de otro trainer del mismo tenant (filtrado). Reset de password de TRAINER por OWNER funciona; reset por TRAINER → 403.

---

### Step 13 — Panel de superadmin (backend): CRUD tenants + OWNER inicial

**Objetivo**: dejar el SUPERADMIN operativo end-to-end vía API antes de hacer el frontend.

**Hacer**:

- Mover `POST /tenants` a `POST /superadmin/tenants` (público en Step 4 ya no aplica; ahora pasa por `SuperadminGuard`).
- `POST /superadmin/tenants` crea tenant + OWNER inicial **en una sola transacción**: tenant (`is_active=true`), user OWNER con password generada (`must_change_password=true`). Response devuelve `{ tenant, owner: { id, email, ... }, ownerPassword: "..." }` con la password **una vez**.
- `GET /superadmin/tenants` con filtro `?active=true|false|all`.
- `PATCH /superadmin/tenants/:id` para toggle `is_active` y editar branding.
- `POST /superadmin/tenants/:id/reset-owner-password`: genera nueva password del OWNER (el primero del tenant; si hay varios, ver al implementar), devuelve **una vez**, `must_change_password=true`, revoca refresh tokens.
- `GET /tenants/by-slug/:slug` (público) sigue tal cual para la página del tenant.

**Criterio**: E2E:

- Sin JWT de SUPERADMIN → 401.
- Con JWT de OWNER de un tenant → 403.
- Con JWT de SUPERADMIN: crear tenant + OWNER funciona, devuelve password una vez; OWNER puede loguearse desde `<slug>.rutinex.app` con esa password y entra al flujo `mustChangePassword`.
- Toggle `is_active=false` → todos los logins del tenant rechazan 403 `TENANT_INACTIVE`.
- Reset password OWNER → la vieja deja de funcionar, la nueva sí, el OWNER queda con `mustChangePassword=true`.

---

### Step 14 — CRUD: Exercises

**Objetivo**: ejercicios del tenant.

**Hacer**:

- Entity + migración.
- CRUD completo. Solo OWNER y TRAINER pueden crear/editar/borrar. STUDENT puede leer.
- Validación de URL de media.
- Endpoint `GET /exercises` con búsqueda por título y filtro por `muscle_groups`.

**Criterio**: E2E.

---

### Step 15 — Storage de media (R2)

**Objetivo**: subir gifs/videos de ejercicios a Cloudflare R2.

**Hacer**:

- Bucket en R2 (manual, una vez). Credenciales en env.
- `POST /media/upload-url` que devuelve una presigned URL para PUT directo desde el cliente.
- `POST /media/confirm` para asociar el archivo subido a un exercise.
- Límite de tamaño: 50MB para videos, 10MB para gifs, 5MB para imágenes.
- Validación de mime type en confirm.

**Criterio**: E2E manual con curl + frontend de prueba.

---

### Step 16 — CRUD: Routines + RoutineItems

**Objetivo**: armar rutinas con ejercicios ordenados.

**Hacer**:

- Entities + migración.
- `POST /routines` con items embebidos.
- `PATCH /routines/:id` (reordenar items, agregar, quitar).
- `GET /routines/:id` con items y ejercicios resueltos.

**Criterio**: E2E. Reordenar funciona.

---

### Step 17 — Asignación de rutina a alumno

**Objetivo**: vincular rutina con alumno.

**Hacer**:

- Entity `Assignment` + migración.
- `POST /routines/:id/assignments` con `studentId`, `startsOn`, `endsOn?`, `weekdayMask`.
- `GET /students/:id/assignments` (activas y vencidas).
- `DELETE /assignments/:id`.

**Criterio**: E2E. Trainer no puede asignar a alumno de otro trainer (a evaluar: por ahora lo dejamos restringido).

---

### Step 18 — Sesión + tracking de sets

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

### Step 19 — Personal Records

**Objetivo**: derivar y consultar PRs.

**Hacer**:

- Entity `PersonalRecord` + migración.
- Cálculo dentro de la transacción de "POST /sets": si supera, upsert.
- `GET /students/:id/personal-records` y `GET /students/:id/personal-records/:exerciseId`.

**Criterio**: E2E. Concurrencia: dos POST de set simultáneos no rompen el PR (test con jest + transacción).

---

### Step 20 — Comments

**Objetivo**: comentarios del alumno en ejercicios/sesiones.

**Hacer**:

- Entity + migración.
- `POST /comments`, `GET /comments` filtrable.
- Solo el dueño puede borrar el suyo.

**Criterio**: E2E.

---

## Fase 2 — Frontend foundations

### Step 21 — Setup base del frontend (landing comercial + middleware completo)

**Objetivo**: middleware con los 3 surfaces (landing, tenant, superadmin), shadcn instalado, landing sales-led.

**Hacer**:

- `middleware.ts` con detección de host (ver `docs/03-multi-tenancy.md`):
  - `superadmin.rutinex.app` → rewrite a `/superadmin/...`.
  - `<slug>.rutinex.app` → rewrite a `/t/:slug/...` (ya estaba en Step 4.5).
  - root → sin rewrite (landing).
- Eliminar el form de signup del Step 4.5; landing comercial con hero + beneficios + botón "Contactanos por WhatsApp" (`wa.me/${env.contactWhatsapp}`).
- `/pricing` informativa con tabla de planes y CTA al mismo WhatsApp.
- Route groups `(admin)`, `(student)`, `(superadmin)` con layouts placeholder (los layouts reales con guards en Step 22).
- shadcn/ui inicializado.
- `lib/env.ts` agrega `contactWhatsapp` (`NEXT_PUBLIC_CONTACT_WHATSAPP`).
- `lib/subdomain.ts` agrega `isSuperadminHost(host)`.

**Criterio**: localhost funciona. `localhost:3000` muestra landing con CTA WhatsApp; `superadmin.localhost:3000` muestra placeholder del surface superadmin; `<slug>.localhost:3000` muestra el tenant.

---

### Step 22 — Auth en frontend (todas las superficies)

**Objetivo**: login en cada surface, refresh silencioso, guard de `mustChangePassword` a nivel layout.

**Hacer**:

- Store de auth con Zustand (access token en memoria).
- `useAuth()` hook.
- Páginas:
  - `<slug>.rutinex.app/login`: tab "Staff" (email + password → `POST /auth/login`) + tab "Soy alumno" (DNI → `POST /auth/student-login`).
  - `<slug>.rutinex.app/change-password` (forzado y voluntario).
  - `superadmin.rutinex.app/login` (email + password → `POST /auth/login`).
  - `superadmin.rutinex.app/change-password` (por consistencia, aunque hoy no se dispara).
- **Layouts `(admin)` y `(superadmin)`**: si `user.mustChangePassword === true`, no renderizan children — renderizan solo el form de `/change-password` (modo forzado).
- Refresh silencioso al cargar la app.
- Redirect a login si protected route sin auth.
- Mapeo de error codes (`TENANT_INACTIVE`, `USER_INACTIVE`) a mensajes específicos.

**Criterio**: login funcional contra el API en los tres surfaces. Refresh tras 15min funciona. Login con password generada lleva al user al form forzado de `/change-password`; el resto del surface no es accesible hasta resolverlo.

---

### Step 23 — Panel admin: alumnos

**Objetivo**: OWNER/TRAINER ven y gestionan alumnos.

**Hacer**:

- `/(admin)/students` con lista paginada.
- `/(admin)/students/new` con form (DNI requerido, sin password).
- `/(admin)/students/:id` con detalle y toggle activo/inactivo.

**Criterio**: flujo completo en mobile y desktop.

---

### Step 24 — Panel admin: ejercicios y rutinas

**Objetivo**: CRUD desde frontend.

**Hacer**:

- `/(admin)/exercises` lista, crear, editar.
- Subida de media con presigned URL (Step 15).
- `/(admin)/routines` lista, builder con drag&drop de items.

**Criterio**: TRAINER puede armar una rutina con 5 ejercicios y subir un gif.

---

### Step 25 — Panel admin: asignaciones

**Objetivo**: asignar rutina a alumno desde UI.

**Hacer**:

- En `/(admin)/students/:id`, tab "Rutinas".
- Picker de rutina + fechas + días de la semana.

**Criterio**: TRAINER asigna y el STUDENT la ve.

---

### Step 26 — App del student: home, sesión, tracking

**Objetivo**: alumno entra, ve la rutina del día, la ejecuta.

**Hacer**:

- `/(student)/` home con "Hoy".
- Tap en ejercicio → vista de detalle con video/gif, descripción.
- Tracking de sets inline.
- Botón "Completar sesión".
- Branding aplicado desde el tenant.

**Criterio**: flujo end-to-end completo. Un alumno puede entrenar una sesión real.

---

### Step 27 — App del student: histórico y PRs

**Objetivo**: el alumno ve su progreso.

**Hacer**:

- `/(student)/history` con sesiones pasadas.
- `/(student)/exercises/:id` con histórico por ejercicio y PR.

**Criterio**: el alumno ve su evolución.

---

### Step 28 — Frontend del SUPERADMIN

**Objetivo**: surface `(superadmin)` completo para operar sales-led desde el navegador.

**Hacer**:

- `/(superadmin)/tenants`: tabla con filtro activo/inactivo, búsqueda por slug/name.
- `/(superadmin)/tenants/new`: form (slug, name, branding opcional, email + nombre + apellido del OWNER). Al crear, muestra modal con la password del OWNER en plano + botón "Copiar". Mensaje claro de "se muestra una sola vez".
- `/(superadmin)/tenants/:id`: detalle con toggle `is_active`, edit branding, botón "Resetear password OWNER" (mismo modal de password).
- Mensajes y UX consistentes para el flujo de "copiar la password y pasársela por WhatsApp".

**Criterio**: el SUPERADMIN puede crear un tenant + OWNER, copiar la password, pasarla, el OWNER se loguea, pasa por `change-password`, queda operativo. Toggle inactivo bloquea el login del tenant.

---

## Fase 3 — Producción

### Step 29 — Deploy

**Objetivo**: producción mínima.

**Hacer**:

- DNS con wildcard (incluido `superadmin.rutinex.app`).
- API en Railway o Fly.
- Web en Vercel.
- Postgres en Neon.
- R2 ya configurado en Step 15.
- Variables de entorno seteadas en cada plataforma (incluido `NEXT_PUBLIC_CONTACT_WHATSAPP`).
- Smoke test post-deploy.
- Seed del primer SUPERADMIN en prod vía `pnpm --filter api seed:superadmin`.

**Criterio**: SUPERADMIN crea un tenant desde `superadmin.rutinex.app`, el OWNER entra, crea un alumno, el alumno ejecuta una sesión, todo en prod.

---

### Step 30 — Observabilidad mínima

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
- Audit log de acciones del SUPERADMIN (crear tenant, reset password, toggle `is_active`, edit branding).
- Rate limiting más agresivo en `superadmin.rutinex.app/login`.
- Self-service signup si el modelo vuelve a PLG (reactivar `/auth/signup`, formulario en landing, validación de slug en signup, email de confirmación).
- **Refactor visual: design tokens en 3 capas + swap tipográfico + toggle dark/light** (ver ADR-016 y `docs/06-frontend-conventions.md` sección "Theming y branding"). Hoy todas las CSS vars viven planas en `:root` con names mezclados (`--brand-*` + alias shadcn) y las fuentes son Geist/Geist Mono heredadas de `create-next-app`. Cuando se priorice este paquete, hacer todo en un solo step para no entreverar tres refactors visuales:
  1. Partir `app/globals.css` en `app/styles/tokens.css` (capa 1 brand + capa 2 semantic + capa 3 component, todo declarado explícitamente) + el resto de `globals.css` (resets, base layer, `@theme inline` mapeando solo capa 2/3).
  2. Renombrar las vars existentes a la nomenclatura semántica (`--brand-primary` → `--color-accent`, etc.) y dejar capa 3 como alias para shadcn. Componentes que ya usan utilities (`bg-card`, `text-foreground`) no cambian; solo cambia el origen de las vars.
  3. `lib/theme.ts` con `tenantThemeVars(branding)` que devuelve el set chico de vars overridables por el tenant (hoy `--color-accent` + `--color-accent-fg` + `--ring`). Reemplaza el inline ad hoc del Step 4.5 en `app/t/[slug]/page.tsx` y se usa también desde el wrapper de admin/student.
  4. Swap tipográfico: Geist → **Montserrat** (sans/heading) y Geist Mono → **JetBrains Mono** (mono), cargadas con `next/font/google` en `app/layout.tsx`. Vars expuestas: `--font-sans`, `--font-heading`, `--font-mono`. Borrar referencias a `--font-geist-*`.
  5. Variante light: duplicar bindings de capa 2 bajo `[data-theme="light"]` con paleta invertida (capa 1 no se duplica). Definir el contraste de los acentos light por tenant (función derivadora en `lib/theme.ts`).
  6. Toggle en el header de cada surface (landing, admin, student, superadmin). Default: `prefers-color-scheme`. Persistencia: cookie httpOnly `SameSite=Lax` leída en el server layout para evitar flash de tema incorrecto en SSR.
  7. Smoke visual: las 9 rutas del Step 7.5 (landing, /superadmin/tenants, /t/[slug], /t/[slug]/admin, /t/[slug]/admin/students, /t/[slug]/admin/students/[id], /t/[slug]/student, /t/[slug]/student/exercises/[id]) renderean igual en dark, se ven coherentes en light, y un tenant con `primaryColor` distinto no rompe ningún contraste.

  Criterio: rebrand hipotético (cambiar el naranja por verde) implica reemplazar solo la escala `--rutinex-orange-*` por `--rutinex-green-*` en `tokens.css` y reasignar `--color-accent` a la nueva escala; nada más se toca. Toggle funcional en las 4 surfaces.

- Invitación de alumno por email/WhatsApp con link mágico.
- Comentarios visibles al trainer + notifs.
- PWA (manifest + service worker, install prompt).
- Catálogo de ejercicios global compartido.
- Mediciones corporales (peso, perímetros).
- Plan nutricional.
- Reportes para el trainer (alumnos activos, sesiones por semana).
- 2FA para trainers y SUPERADMIN.
- Dashboard del OWNER con métricas del negocio.
