# 04 — Auth

## Resumen

- **Auth propia**, sin Clerk/Auth0.
- **Passport** con dos strategies: `local` (login con email+password) y `jwt` (validar bearer token en cada request autenticada).
- **Passwords** hasheadas con **Argon2id** (parámetros conservadores: memoryCost=19456, timeCost=2, parallelism=1 → mínimo OWASP 2024).
- **Tokens**: access token corto (15min) + refresh token largo (30 días), rotativo.
- **Refresh tokens** en DB con hash, no en cookie firmada. Permite revocación inmediata.

## Endpoints

| Endpoint                          | Auth   | Descripción                                       |
|-----------------------------------|--------|---------------------------------------------------|
| `POST /auth/signup`               | -      | Solo para OWNER + tenant. Crea tenant y user OWNER. |
| `POST /auth/login`                | -      | Email + password (+ slug si ambigüedad). Devuelve access + refresh. |
| `POST /auth/refresh`              | -      | Refresh token. Rota el refresh y devuelve par nuevo. |
| `POST /auth/logout`               | bearer | Revoca el refresh token actual.                   |
| `POST /auth/logout-all`           | bearer | Revoca todos los refresh del usuario.             |
| `POST /auth/password-reset`       | -      | Inicia flujo. Manda email con token (fase 2).     |
| `POST /auth/password-reset/confirm` | -    | Confirma con token + nueva password.              |
| `POST /auth/change-password`      | bearer | Cambio voluntario, requiere password actual.       |

## Modelo de tokens

### Access token (JWT)

```json
{
  "sub": "<user_id>",
  "tid": "<tenant_id>",
  "role": "OWNER" | "TRAINER" | "STUDENT",
  "iat": ...,
  "exp": ... (15min)
}
```

Firmado con HS256 y secret de env (`JWT_ACCESS_SECRET`). El secret se rota cada N meses; cuando se rota, todos los tokens vivos caducan (aceptable porque el access es de 15min).

### Refresh token

- Opaque token (no JWT): 64 bytes random base64url.
- Se guarda en `refresh_tokens` con el hash SHA-256 del token (no el token plano).
- Cliente lo guarda en httpOnly secure cookie (web) o en secure storage (mobile/PWA fase 2).

**Tabla `refresh_tokens`**:

| Campo           | Tipo         | Notas                                          |
|-----------------|--------------|------------------------------------------------|
| `id`            | uuid PK      |                                                |
| `tenant_id`     | uuid FK      |                                                |
| `user_id`       | uuid FK      | Index.                                         |
| `token_hash`    | varchar(64)  | SHA-256 hex.                                   |
| `expires_at`    | timestamptz  |                                                |
| `revoked_at`    | timestamptz  | Nullable.                                      |
| `replaced_by`   | uuid FK self | Si se rotó, apunta al token nuevo.             |
| `user_agent`    | varchar      | Para que el user pueda ver "Mis sesiones".     |
| `ip`            | varchar      |                                                |
| `created_at`    | timestamptz  |                                                |

## Flujos

### Login

1. Cliente: `POST /auth/login { email, password, slug? }`.
2. Resolución de tenant:
   - Si la request vino con `x-tenant-slug` (subdominio del alumno) → usar ese slug.
   - Sino, si `slug` en body → usar ese.
   - Sino, buscar por email en toda la DB. Si hay 1 match → ok. Si hay >1 → 400 "Especificá tu gimnasio".
3. Buscar `user` por `email + tenant_id`. Si no existe → 401 genérico.
4. Si `user.is_active = false` → 403 "Cuenta pausada".
5. Si `tenant.is_active = false` → 403 "Plataforma inactiva".
6. Verificar password con Argon2. Si no matchea → 401 genérico.
7. Emitir access JWT (15min) y refresh opaque (30d).
8. Guardar `refresh_tokens` row con hash.
9. Devolver `{ accessToken, refreshToken, user: { id, role, firstName, lastName, tenant: { slug, branding } } }`.

### Refresh (rotación)

1. Cliente: `POST /auth/refresh { refreshToken }`.
2. Hashear refreshToken → buscar en DB.
3. Si no existe / expirado / revocado → 401.
4. Si está OK: revocar (set `revoked_at`), crear uno nuevo, setear `replaced_by` en el viejo.
5. Devolver nuevo par `{ accessToken, refreshToken }`.

**Detección de reuso**: si llega un refresh que ya está revocado, es señal de que alguien lo robó y lo usó después. Acción: revocar **todos** los refresh tokens del usuario y forzar re-login. Loggear como incidente.

### Logout

1. Cliente: `POST /auth/logout` con bearer + refreshToken en body.
2. Marcar `revoked_at` en el refresh.
3. 204.

### Cambio de password

1. Verificar password actual.
2. Hashear nueva.
3. Update `users.password_hash`.
4. **Revocar todos los refresh tokens del user** (forzar re-login en otros devices).

## Guards y decoradores

Vienen del módulo `auth`. Resumen:

| Decorador / Guard          | Para qué                                                              |
|----------------------------|------------------------------------------------------------------------|
| `@Public()`                | Marca endpoints sin auth. (El JWT guard global skipea estos.)         |
| `JwtAuthGuard` (global)    | Valida access token y popula `req.user`.                              |
| `RolesGuard`               | Junto con `@Roles('OWNER')` o `@Roles('TRAINER', 'OWNER')`.            |
| `TenantGuard` (global)     | Valida que el `x-tenant-slug` (si vino) coincida con el JWT.          |
| `@CurrentUser()`           | Inyecta el user actual en el handler.                                  |
| `@TenantId()`              | Inyecta el `tenantId` actual.                                          |

Orden de guards: `JwtAuthGuard` → `TenantGuard` → `RolesGuard`.

## Seguridad práctica

- **Rate limiting** en `/auth/login` y `/auth/password-reset`: máximo 5 intentos por IP+email por 15min. Usamos `@nestjs/throttler` (no requiere Redis).
- **No revelar si el email existe** en login y password-reset. Mensajes genéricos.
- **CORS**: el API solo acepta requests desde `*.rutinex.app` y `localhost:3000` (dev). Configurado en `main.ts`.
- **CSRF**: no aplica si usamos `Authorization: Bearer` desde JS (no cookies en cross-site con credentials). Si en algún punto pasamos a sessions con cookie, agregar protección CSRF.
- **Cookies de refresh**: `httpOnly`, `secure`, `SameSite=Lax`, scope al subdominio root `.rutinex.app` para que funcione cross-subdominio.
- **Secrets**: `JWT_ACCESS_SECRET`, `JWT_REFRESH_PEPPER` (sal extra para hash de refresh), `ARGON2_PEPPER` opcional. En `.env`, nunca en código.
- **Tiempo constante** en comparación de password: lo da Argon2 nativamente.

## Lo que NO hay en MVP

- **2FA**: no en MVP. Espacio reservado en `users` para `totp_secret` fase 2.
- **OAuth (Google, etc.)**: no en MVP.
- **Sesiones gestionadas en server** (Redis): no necesario, refresh en DB alcanza.
- **Magic links**: no en MVP. Se considera para invitación de alumno en fase 2.

## Bootstrap (cuentas iniciales)

- **Sin signup público para STUDENT y TRAINER**. Solo el OWNER puede signup-ear desde landing. TRAINER lo crea el OWNER. STUDENT lo crea el TRAINER. Cuando se crea un user no-OWNER, la password se devuelve una vez en la response (MVP) y queda fuera de logs. Fase 2: invitación por mail.
- El primer admin de Rutinex (vos) se crea con un script `pnpm --filter api seed:bootstrap` que pide tenant slug, email y password por stdin. Documentado en `apps/api/scripts/README.md` cuando exista.
