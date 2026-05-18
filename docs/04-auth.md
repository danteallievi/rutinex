# 04 — Auth

## Resumen

- **Auth propia**, sin Clerk/Auth0.
- **Passport** con dos strategies: `local` (login con email+password) y `jwt` (validar bearer token en cada request autenticada).
- **Passwords** hasheadas con **Argon2id** (parámetros conservadores: memoryCost=19456, timeCost=2, parallelism=1 → mínimo OWASP 2024).
- **Tokens**: access token corto (15min) + refresh token largo (30 días), rotativo.
- **Refresh tokens** en DB con hash SHA-256, no en cookie firmada. Permite revocación inmediata, detección de reuso y rotación atómica. Transportados al cliente por **body + cookie httpOnly** (ver ADR-017).
- **Onboarding sales-led**: no hay signup público. Los tenants y sus OWNERs los crea el SUPERADMIN desde su panel. Ver ADR-012.
- **STUDENTS sin password**: se loguean por DNI dentro del subdominio de su tenant. Ver ADR-014.

## Endpoints

| Endpoint                         | Auth       | Descripción                                                                                                                                                                    |
| -------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /auth/login`               | -          | Email + password. Slug viene del subdominio (`x-tenant-slug` o host `superadmin`). Devuelve access + refresh.                                                                  |
| `POST /auth/student-login`       | -          | DNI. Slug viene del subdominio. Solo para STUDENTS. Devuelve access + refresh.                                                                                                 |
| `POST /auth/refresh`             | -          | Refresh token. Rota el refresh y devuelve par nuevo.                                                                                                                           |
| `POST /auth/logout`              | bearer     | Revoca el refresh token actual.                                                                                                                                                |
| `POST /auth/logout-all`          | bearer     | Revoca todos los refresh del usuario.                                                                                                                                          |
| `POST /auth/change-password`     | bearer     | Forzado (`must_change_password=true`): solo `newPassword`. Voluntario: `currentPassword` + `newPassword`.                                                                      |
| `POST /superadmin/tenants`       | superadmin | Crea tenant + OWNER inicial en una transacción. Devuelve password del OWNER **una vez**.                                                                                       |
| `POST /users/:id/reset-password` | bearer     | OWNER puede resetear password de TRAINER del mismo tenant; SUPERADMIN puede resetear password de OWNER. Genera nueva, devuelve **una vez**, setea `must_change_password=true`. |

> **Eliminado del MVP**: `POST /auth/signup` (no hay onboarding self-service), `POST /auth/password-reset` y `POST /auth/password-reset/confirm` (no hay flujo de "olvidé mi password" por email — el reset lo hace el OWNER o el SUPERADMIN). Si el modelo vuelve a PLG en el futuro, ver ADR-012.

## Modelo de tokens

### Access token (JWT)

Shape final del payload:

```json
{
  "sub": "<user_id>",
  "tenantId": "<tenant_id>" | null,
  "role": "OWNER" | "TRAINER" | "STUDENT" | null,
  "isSuperadmin": true | false,
  "iat": ...,
  "exp": ... (15min)
}
```

- `tenantId`: UUID del tenant del user. **NULL** si `isSuperadmin=true`.
- `role`: rol dentro del tenant. **NULL** si `isSuperadmin=true`.
- `isSuperadmin`: flag para el `SuperadminGuard`. Mutuamente excluyente con `tenantId`/`role`.

Firmado con HS256 y secret de env (`JWT_ACCESS_SECRET`). El secret se rota cada N meses; cuando se rota, todos los tokens vivos caducan (aceptable porque el access es de 15min).

### Refresh token

- Opaque token (no JWT): **64 bytes random base64url** (~86 chars sin padding). Generado con `crypto.randomBytes` y nunca persistido en plano.
- Se guarda en `refresh_tokens` con el **hash SHA-256 hex de 64 chars** del token (no el token plano).
- TTL: **30 días** (`REFRESH_TOKEN_TTL_MS` en `apps/api/src/modules/auth/refresh-token.constants.ts`).
- **Transporte cliente ↔ server** (ADR-017): el server devuelve `refreshToken` en el body de login/student-login/refresh **y también** setea una cookie httpOnly `rutinex_refresh` (ver "Cookie de refresh" abajo). El server lee el refresh del **body como prioridad, con la cookie como fallback**, así el web puede ignorar el body y operar sólo con la cookie, mientras que mobile/PWA/tests usan el body directo.
- Mismas refresh tokens para users de tenant y para SUPERADMINs (`tenant_id` de la fila puede ser NULL para SUPERADMINs, igual que en `users`).
- En cada emisión se guardan `user_agent` (truncado a 255 chars) e `ip` (`req.ip`; en prod requiere `trust proxy=1` para que venga del `X-Forwarded-For`) para que más adelante se pueda mostrar "Mis sesiones" en el panel del user.

**Tabla `refresh_tokens`**:

| Campo         | Tipo             | Notas                                                                  |
| ------------- | ---------------- | ---------------------------------------------------------------------- |
| `id`          | uuid PK          |                                                                        |
| `tenant_id`   | uuid FK nullable | NULL para refresh tokens de SUPERADMIN; NOT NULL para users de tenant. |
| `user_id`     | uuid FK          | Index.                                                                 |
| `token_hash`  | varchar(64)      | SHA-256 hex.                                                           |
| `expires_at`  | timestamptz      |                                                                        |
| `revoked_at`  | timestamptz      | Nullable.                                                              |
| `replaced_by` | uuid FK self     | Si se rotó, apunta al token nuevo.                                     |
| `user_agent`  | varchar          | Para que el user pueda ver "Mis sesiones".                             |
| `ip`          | varchar          |                                                                        |
| `created_at`  | timestamptz      |                                                                        |

## Política de password generada por el sistema

Aplica cuando se crea un OWNER (por SUPERADMIN), un TRAINER (por OWNER), o se resetea cualquiera de los dos.

- **Largo**: 16 caracteres.
- **Alfabeto**: `[a-zA-Z0-9]` excluyendo `0`, `O`, `o`, `1`, `l`, `I` (para legibilidad).
- **Sin caracteres especiales**: la pass se comunica por WhatsApp, donde caracteres especiales se autocorrigen o se ven raros.
- Generada con CSPRNG (`crypto.randomBytes`).
- Hasheada con Argon2id (mismos parámetros que cualquier password) antes de persistirse.
- Devuelta en plano **una sola vez** en la response del endpoint de creación/reset. No se loggea, no se guarda en plano, no se reenvía.
- El user creado/reseteado queda con `must_change_password=true`. En el primer login, el frontend lo lleva a `/change-password` (modo forzado) antes de cualquier otra cosa.

## Flujos

### Login (OWNER, TRAINER, SUPERADMIN)

1. Cliente: `POST /auth/login { email, password }`. La superficie se resuelve por el header `Host` (en tests se acepta override con `x-rutinex-host`): host `superadmin.<algo>` → flujo SUPERADMIN; host `<slug>.<algo>` → flujo de tenant (el slug se infiere del subdominio).
2. Resolución de tenant según el host:
   - **Host `superadmin.rutinex.app`** → buscar `user` por `email` con `is_superadmin=true` y `tenant_id IS NULL` (matchea el índice parcial único `users_email_global_unique`).
   - **Host `<slug>.rutinex.app`** → resolver `tenant_id` desde el slug; buscar `user` por `(tenant_id, email)` con `is_superadmin=false`.
   - Si el host no matchea ninguno de los dos patrones → `401 invalid credentials` genérico.
3. Si no existe el `user` → `401 invalid credentials` con `code: INVALID_CREDENTIALS` (mensaje genérico, sin filtrar existencia).
4. Si el host es de tenant y `tenant.is_active = false` → `403 tenant inactive` con código `TENANT_INACTIVE` y mensaje "Tu cuenta está pausada. Contactá a tu vendedor por WhatsApp."
5. Si `user.is_active = false` → `403 user inactive` con código `USER_INACTIVE` y mensaje "Tu cuenta está pausada, contactá a tu entrenador."
6. Verificar password con Argon2. Si no matchea → `401 invalid credentials` genérico.
7. Emitir access JWT (15min) con `{ sub, tenantId, role, isSuperadmin, iat, exp }` y refresh opaque (30d).
8. Guardar `refresh_tokens` row con hash.
9. Devolver:

   ```json
   {
     "accessToken": "...",
     "refreshToken": "...",
     "user": {
       "id": "...",
       "role": "OWNER" | "TRAINER" | null,
       "isSuperadmin": true | false,
       "mustChangePassword": true | false,
       "firstName": "...",
       "lastName": "...",
       "tenant": { "slug": "...", "branding": { ... } } | null
     }
   }
   ```

10. Frontend: si `mustChangePassword=true`, redirige a `/change-password` (modo forzado) antes de mostrar el resto del surface.

> Shape exacto del body (Step 9, sales-led): además de los campos arriba, la response incluye `refreshToken` (string opaque, 86 chars) y `refreshTokenExpiresAt` (ISO timestamp). El web puede ignorarlos y operar sólo con la cookie httpOnly (ver ADR-017). El response shape vive como `LoginResponse` en `apps/api/src/modules/auth/auth.service.ts` — fuente de verdad para el frontend.

### Login de STUDENT (por DNI)

1. Cliente: `POST /auth/student-login { dni }`. Slug viene del header `x-tenant-slug` (subdominio).
2. Si el host es `superadmin.rutinex.app` → `401 invalid credentials` (este endpoint no existe en ese surface).
3. Resolver `tenant_id` desde el slug.
4. Si `tenant.is_active = false` → `403 tenant inactive` (mismo código y mensaje que login).
5. Buscar `user` por `(tenant_id, dni)` con `role='STUDENT'`. Si no existe → `401 invalid credentials`.
6. Si `user.is_active = false` → `403 user inactive`.
7. Emitir access JWT con `{ sub, tenantId, role: 'STUDENT', isSuperadmin: false, ... }` y refresh opaque.
8. Devolver el mismo shape que `/auth/login`, con `mustChangePassword: false` siempre.

### Refresh (rotación)

1. Cliente: `POST /auth/refresh` — refreshToken en body o cookie `rutinex_refresh` (ADR-017). Endpoint público (no requiere bearer).
2. Hashear refreshToken → buscar en DB.
3. Si no existe / expirado → 401 genérico (`INVALID_CREDENTIALS`).
4. Si el refresh **ya estaba revocado** → **detección de reuso**: revocar todos los refresh activos del user, loggear como incidente (`Logger` de NestJS, sin volcar el token) y devolver 401 genérico.
5. Si está OK: revocar (set `revoked_at`), crear uno nuevo, setear `replaced_by` del viejo apuntando al nuevo.
6. Resolver `user` con `findById` + tenant si aplica. Si user o tenant están pausados / no existen → revocar el refresh recién emitido y devolver 401 genérico (sin filtrar `USER_INACTIVE` / `TENANT_INACTIVE` desde el refresh — esos códigos son del login).
7. Devolver `LoginResponse` con `accessToken` + `refreshToken` nuevos + `user` actualizado. Setear cookie `rutinex_refresh` con el nuevo.

### Logout

1. Cliente: `POST /auth/logout` con bearer. Refresh por body o cookie (ADR-017).
2. Si hay refresh: marcar `revoked_at`. Si no hay, o el refresh no matchea, igual responder 204 (idempotente, no se filtra existencia).
3. Limpiar cookie `rutinex_refresh`.
4. 204.

### Logout en todos los devices

1. Cliente: `POST /auth/logout-all` con bearer (sin body).
2. Revocar todos los refresh tokens activos del `req.user.userId`.
3. Limpiar cookie `rutinex_refresh`.
4. 204.

### Change password

Mismo endpoint, dos modos según `users.must_change_password`. La fortaleza mínima de la nueva password está fijada en **12 caracteres** (`MIN_USER_PASSWORD_LENGTH` en `apps/api/src/modules/auth/password.service.ts`), alineada con la mínima del CLI `seed:superadmin`. El DTO lo valida con `@MinLength(MIN_USER_PASSWORD_LENGTH)` → 400 automático si la nueva password es muy corta. Sin reglas extra de complejidad por ahora; cualquier cambio futuro se ajusta tocando la constante.

**Forzado (`must_change_password=true`)**:

1. Cliente: `POST /auth/change-password { newPassword }` con bearer (el JWT del login con la password generada autentica al user; no se pide la password actual porque el flujo asume que el user la recibió por WhatsApp y la quiere reemplazar al toque). Si llega `currentPassword`, se ignora.
2. Validar fortaleza de la nueva (`MIN_USER_PASSWORD_LENGTH`, ver arriba).
3. Hashear con Argon2id.
4. Update `users.password_hash` + `must_change_password=false`.
5. Revocar todos los refresh tokens del user (forzar re-login en otros devices).
6. Limpiar cookie `rutinex_refresh`.
7. Devolver 204.

**Voluntario (`must_change_password=false`)**:

1. Cliente: `POST /auth/change-password { currentPassword, newPassword }` con bearer.
2. Si falta `currentPassword` → 400 `CURRENT_PASSWORD_REQUIRED`.
3. Verificar `currentPassword` con Argon2. Si no matchea → 401 genérico (`INVALID_CREDENTIALS`).
4. Hashear nueva. Update `users.password_hash`.
5. Revocar todos los refresh tokens del user.
6. Limpiar cookie `rutinex_refresh`.
7. Devolver 204.

> Decisión: **no usamos magic links ni activation tokens** para el primer login. La password generada que se entrega por WhatsApp ya cumple ese rol y simplifica el modelo (un solo flujo de auth, sin tabla de tokens de activación). Ver ADR-013.

### Reset de password (por OWNER o SUPERADMIN)

- `POST /users/:id/reset-password` (auth bearer):
  - **OWNER**: solo puede resetear la password de un TRAINER del mismo tenant.
  - **SUPERADMIN**: solo puede resetear la password de un OWNER (en `/superadmin/users/:id/reset-password` o en el mismo endpoint con autorización por jerarquía — a decidir en el step correspondiente).
  - **TRAINER**: no puede resetear nada (los STUDENTS no tienen password).
- Genera nueva password con la política de arriba, la devuelve **una vez** en la response, setea `must_change_password=true` y revoca todos los refresh tokens del user reseteado.

## Auth del SUPERADMIN

El SUPERADMIN usa exactamente el mismo flujo de auth: mismo endpoint `POST /auth/login`, mismo JWT secret, misma tabla `refresh_tokens`. Las diferencias son:

- Se loguea desde el host `superadmin.rutinex.app`. Su user tiene `is_superadmin=true` y `tenant_id IS NULL`.
- El JWT que recibe lleva `tenantId: null`, `role: null`, `isSuperadmin: true`.
- Sus rutas `/superadmin/*` están protegidas por `SuperadminGuard` (verifica `req.user.isSuperadmin === true`). No pasan por `TenantGuard` ni requieren `x-tenant-slug`.
- Si un user de tenant intenta loguearse desde `superadmin.rutinex.app` (o un SUPERADMIN desde un subdominio de tenant), recibe `401 invalid credentials` genérico — no se filtra existencia entre superficies.

> TODO post-MVP: rate limiting más agresivo en `superadmin.rutinex.app/login` (por ser el blast radius más grande) y audit log de todas las acciones del SUPERADMIN (crear tenant, reset password, toggle `is_active`, edit branding).

## Guards y decoradores

Vienen del módulo `auth`. Resumen:

| Decorador / Guard       | Para qué                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `@Public()`             | Marca endpoints sin auth. (El JWT guard global skipea estos.)                                                             |
| `JwtAuthGuard` (global) | Valida access token y popula `req.user` (incluye `isSuperadmin`).                                                         |
| `RolesGuard`            | Junto con `@Roles('OWNER')` o `@Roles('TRAINER', 'OWNER')`. No aplica a SUPERADMIN.                                       |
| `SuperadminGuard`       | Requiere `req.user.isSuperadmin === true`. 403 con `code: NOT_SUPERADMIN` si falla. Usado en controllers `/superadmin/*`. |
| `TenantGuard` (global)  | Valida que el `x-tenant-slug` (si vino) coincida con el JWT. Skipea `/superadmin/*`.                                      |
| `@CurrentUser()`        | Inyecta el user actual en el handler.                                                                                     |
| `@TenantId()`           | Inyecta el `tenantId` actual.                                                                                             |

Orden de guards: `JwtAuthGuard` → (`SuperadminGuard` para `/superadmin/*` | `TenantGuard` para el resto) → `RolesGuard`.

## Seguridad práctica

- **Rate limiting** en `/auth/login` y `/auth/student-login`: máximo 5 intentos por IP+email|dni por 15min. Usamos `@nestjs/throttler` (no requiere Redis). En `superadmin.rutinex.app/login` se aplica un límite más agresivo (TODO post-MVP).
- **No revelar si el email/DNI existe** en login. Mensajes genéricos (`401 invalid credentials`) tanto para user inexistente como para password incorrecta.
- **CORS**: el API solo acepta requests desde `*.rutinex.app` y `localhost:3000` + `*.localhost:3000` (dev). Configurado en `main.ts`.
- **CSRF**: no aplica si usamos `Authorization: Bearer` desde JS (no cookies en cross-site con credentials). Si en algún punto pasamos a sessions con cookie, agregar protección CSRF.
- **Cookie de refresh** (`rutinex_refresh`, ADR-017): `httpOnly`, `secure` (en prod), `SameSite=Lax`, `path=/`, scope al subdominio root `.rutinex.app` (controlado por `REFRESH_COOKIE_DOMAIN`) para que funcione cross-subdominio incluido `superadmin.rutinex.app`. En dev local va sin domain (aplica al subdominio actual; alcanza para probar el flujo). Setea expiración al `expires_at` del refresh en DB (30d). El web puede operar **sólo** con la cookie (ignorando el `refreshToken` del body); mobile/PWA/tests usan el body.
- **Secrets**: `JWT_ACCESS_SECRET`, `JWT_REFRESH_PEPPER` (sal extra para hash de refresh), `ARGON2_PEPPER` opcional. En `.env`, nunca en código.
- **Tiempo constante** en comparación de password: lo da Argon2 nativamente.

## Lo que NO hay en MVP

- **Signup público**: no hay `POST /auth/signup`. El onboarding es sales-led. ADR-012.
- **Magic links** y **activation tokens**: no en MVP. La password generada + `must_change_password` cumple el rol de primer login. ADR-013.
- **Password reset por email** (link de "olvidé mi pass"): no en MVP. El OWNER pide reset al SUPERADMIN; el TRAINER pide reset al OWNER; el STUDENT no tiene password.
- **2FA**: no en MVP. Espacio reservado en `users` para `totp_secret` fase 2.
- **OAuth (Google, etc.)**: no en MVP.
- **Sesiones gestionadas en server** (Redis): no necesario, refresh en DB alcanza.

## Bootstrap del primer SUPERADMIN

El primer SUPERADMIN de Rutinex (vos) se crea con un script CLI: `pnpm --filter api seed:superadmin`. Lee email y password desde stdin, los valida, hashea la password con Argon2id y crea el `user` con `is_superadmin=true`, `tenant_id=NULL`, `role=NULL`, `must_change_password=false` (la password la escribiste vos tipeándola, ya es tuya).

Una vez bootstrappeado, ese SUPERADMIN puede crear más SUPERADMINs desde el panel (si llegara a hacer falta — fase posterior, no MVP).

Documentado en `apps/api/scripts/README.md` cuando se cree el script.
