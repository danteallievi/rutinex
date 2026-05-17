# 03 — Multi-tenancy

## Superadmin (fuera del modelo multi-tenant)

Existe un rol especial — **SUPERADMIN** — que vive afuera del modelo multi-tenant: nosotros, los operadores de Rutinex. Se identifica por `users.is_superadmin = true` y `users.tenant_id IS NULL` (sin tabla separada, ver ADR-013).

- Vive en su propio surface: subdominio `superadmin.rutinex.app` (rewrite cableado en Step 21 del roadmap; panel completo en Step 28).
- Sus rutas (`/superadmin/*` en el API) **no** pasan por el `TenantGuard` y **no** requieren header `x-tenant-slug`. Las protege un `SuperadminGuard` que verifica `req.user.isSuperadmin === true`.
- El JWT del SUPERADMIN tiene `tenantId: null` y `isSuperadmin: true`. Mismo secreto, mismas refresh tokens que los users de tenant.
- El primer SUPERADMIN se crea por CLI (`pnpm --filter api seed:superadmin`). Ver `docs/04-auth.md`.

Todo lo de abajo aplica a los users de tenant (OWNER, TRAINER, STUDENT). Los SUPERADMINs son una excepción explícita.

## Estrategia

**Shared database, shared schema, `tenant_id` discriminator column.**

Toda tabla del dominio (excepto `tenants` y los SUPERADMINs en `users`) tiene una columna `tenant_id` NOT NULL con un FK a `tenants.id` e índice. Todo query la filtra. Punto.

Por qué no schema-per-tenant o DB-per-tenant: para arrancar es caro de operar, complica migraciones (hay que aplicarlas N veces), encarece la infra. Cuando un cliente grande lo pida (compliance, aislamiento real), evaluamos schema-per-tenant para ese cliente específico. No se diseña para un caso que no existe.

## Routing por subdominio

### DNS

Wildcard A record:

```
*.rutinex.app  →  Vercel
api.rutinex.app  →  Railway/Fly
rutinex.app  →  Vercel (landing)
```

Vercel acepta wildcard domains en planes pagos; alternativamente, agregamos los subdominios programáticamente vía su API cuando se crea un tenant (en MVP basta con wildcard).

### Middleware Next (`apps/web/middleware.ts`)

El middleware extrae el slug del subdominio (helper en `apps/web/lib/subdomain.ts`) y **reescribe** la URL al prefijo real `/t/:slug/...`. La detección no llama al API: deja pasar la request y el server component del tenant (`app/t/[slug]/page.tsx`) es el que valida existencia contra `GET /tenants/by-slug/:slug` y dispara `notFound()` si el API responde 404.

Casos (post-implementación de Step 4.5 + cambio a sales-led):

| Host                      | Slug        | Resultado                                                                                 |
| ------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| `rutinex.app`             | —           | sin rewrite → landing comercial en `/` (CTA WhatsApp, sin signup)                         |
| `www.rutinex.app`         | —           | reservado → landing                                                                       |
| `superadmin.rutinex.app`  | —           | reservado → surface `(superadmin)`: login propio + panel para SUPERADMIN                  |
| `olimpo.rutinex.app`      | olimpo      | rewrite `/...` → `/t/olimpo/...`. Si sin auth → login del tenant. Auth → admin o student. |
| `olimpo.rutinex.app/foo`  | olimpo      | rewrite `/foo` → `/t/olimpo/foo`                                                          |
| `inexistente.rutinex.app` | inexistente | rewrite a `/t/inexistente`; la page tira 404                                              |

> Cambio respecto al diseño original: el subdominio `app.rutinex.app` **dejó de existir como surface**. Antes era el host del panel admin; ahora OWNER/TRAINER se loguean desde el subdominio de su propio tenant. Esto unifica auth en un solo flujo por tenant y elimina la ambigüedad de email entre tenants. Ver ADR-012.

Reservados (`www`, `superadmin`) y patrones de host que no matchean `*.localhost` / `*.rutinex.app` no se tratan como tenant. Ver código en `apps/web/lib/subdomain.ts`.

Por qué reescribir a un prefijo real y no a una route group (`(student)/`): las route groups del App Router son organizativas y no aparecen en el URL path, así que `NextResponse.rewrite` no puede apuntarles. Detalle en ADR-011.

### URLs de dev

Chrome y Firefox resuelven `*.localhost` automáticamente. No hace falta tocar `/etc/hosts`. Si en Safari aparece algún problema, usar `*.lvh.me` o `*.localtest.me` como host alternativo (todos resuelven a `127.0.0.1`).

```
http://localhost:3000                   → landing (CTA WhatsApp, sin signup)
http://olimpo.localhost:3000            → tenant "olimpo" (rewrite a /t/olimpo)
http://www.localhost:3000               → landing (reservado)
http://superadmin.localhost:3000        → surface (superadmin) (reservado)
http://inexistente.localhost:3000       → 404 "Este gimnasio no existe"
```

### CORS

En dev, el API (`apps/api/src/main.ts`) habilita CORS con regex para `localhost` y `*.localhost` en cualquier puerto. Esto cubre las llamadas desde la landing (`localhost:3000`), el panel SUPERADMIN (`superadmin.localhost:3000`) y los fetches server-side de la página del tenant (`<slug>.localhost:3000`).

En prod (Step 29) el origin se restringe a `rutinex.app` y `*.rutinex.app`.

### Validación en el API

El frontend manda `x-tenant-slug: olimpo` en cada request al API que vive en contexto de tenant. El API tiene un `TenantGuard` global que:

1. Si la ruta es pública (login, student-login, healthcheck) o `/superadmin/*` (que tiene su propio `SuperadminGuard`), no hace nada.
2. Si la ruta es autenticada y vive en contexto de tenant:
   a. Extrae `userId` y `tenantId` del JWT.
   b. Lee `x-tenant-slug` del header.
   c. Carga el tenant por slug y compara `tenant.id === jwt.tenantId`.
   d. Si no coincide → `403 Forbidden`. (Defensa contra alguien que se logueó en un tenant y trata de pegarle a otro.)
   e. Inyecta `tenantId` en el `Request` para que los services lo usen.

Las rutas `/superadmin/*` no necesitan `x-tenant-slug` (operan cross-tenant), no pasan por `TenantGuard`, y exigen `req.user.isSuperadmin === true` vía `SuperadminGuard`.

## Filtrado automático en queries

Riesgo principal de este modelo: olvidarse de filtrar por `tenant_id` en un query y exponer datos cruzados. Mitigaciones, de menos a más estricta:

### Mínimo aceptable (siempre)

Todos los services reciben el `tenantId` desde un parámetro tipado y lo pasan explícitamente al repositorio:

```ts
findAllForTenant(tenantId: string) {
  return this.repo.find({ where: { tenantId } });
}
```

Nunca un service hace `this.repo.find()` sin `where`.

### Recomendado para MVP

Un `TenantScopedRepository<T>` base que envuelve `Repository<T>` y exige `tenantId` en cada método. Los services usan este wrapper en vez del repo crudo. El wrapper se rehúsa a ejecutar queries sin `tenant_id` en el WHERE.

### Fase 2 (cuando duela)

TypeORM Subscribers que injecten `tenant_id` automáticamente desde un `AsyncLocalStorage`, y abort el query si no hay tenant en contexto.

## Branding por tenant

`tenants.branding` es un `jsonb`:

```json
{
  "primaryColor": "#FF5733",
  "accentColor": "#222222",
  "logoUrl": "https://r2.rutinex.app/tenants/olimpo/logo.png",
  "displayName": "Gimnasio Olimpo"
}
```

El frontend lo lee en la página del tenant (server component) y aplica las CSS variables en el `<main>` del tenant (scope local, no global, para no contaminar otras superficies):

```tsx
const cssVars = {
  '--brand-primary': tenant.branding.primaryColor ?? defaultPrimary,
  '--brand-accent': tenant.branding.accentColor ?? defaultAccent,
} as React.CSSProperties;

return <main style={cssVars}>...</main>;
```

Las utilities Tailwind correspondientes (`bg-brand-primary`, `text-brand-primary`) se mapean a esas vars en `apps/web/app/globals.css` vía `@theme inline` (Tailwind 4 — no hay `tailwind.config.ts`). Ver detalle en `docs/06-frontend-conventions.md`.

## Slug del tenant

- Match: `^[a-z0-9]+(-[a-z0-9]+)*$` (DNS-safe).
- Mínimo 3 caracteres, máximo 63 (DNS label max). El entity (`apps/api/src/modules/tenants/entities/tenant.entity.ts`) usa `varchar(63)`.
- Reservados (chocan con superficies propias del producto y se rechazan en `POST /superadmin/tenants` con 409 `SLUG_RESERVED`):
  `admin`, `api`, `app`, `assets`, `auth`, `docs`, `help`, `mail`, `rutinex`, `static`, `status`, `superadmin`, `support`, `www`.
- Inmutable después de creado. Si un cliente lo quiere cambiar, soporte lo hace manualmente y vemos cómo migrar referencias (rarísimo).
- Fuente de verdad en código: `apps/api/src/modules/tenants/slug.ts` (constantes + función `isReservedSlug`). El DTO valida regex + longitud (400) y el service valida reservado + colisión (409).

## Casos borde

- **OWNER o TRAINER se loguea desde `olimpo.rutinex.app/login`**: el slug **siempre** viene del subdominio. El API resuelve `tenant_id` desde el slug y busca `user` por `(tenant_id, email)` con `is_superadmin=false`. No hay ambigüedad cross-tenant porque el slug es parte de la URL.
- **STUDENT se loguea desde `olimpo.rutinex.app/login`** (tab "Soy alumno"): mismo slug del subdominio, endpoint `POST /auth/student-login` con `{ dni }`. Ver `docs/04-auth.md`.
- **STUDENT entra a un slug que no existe**: 404 con página genérica.
- **User entra a `olimpo.rutinex.app` con un JWT de otro tenant**: el `TenantGuard` lo rechaza. El frontend lo desloguea y lo manda al login de `olimpo`.
- **Tenant inactivo (`is_active=false`)**: **rechazo total al login**. Tanto `POST /auth/login` como `POST /auth/student-login` devuelven `403 tenant inactive` con mensaje "Tu cuenta está pausada. Contactá a tu vendedor por WhatsApp." Ningún user del tenant entra — ni OWNER. El SUPERADMIN sigue pudiendo reactivar el tenant desde su panel.
- **SUPERADMIN intenta loguearse desde un subdominio de tenant** (o un user de tenant intenta loguearse desde `superadmin.rutinex.app`): el backend devuelve `401 invalid credentials` genérico, sin filtrar la existencia del user. Cada host tiene su propio criterio de búsqueda: `superadmin` busca `is_superadmin=true`; los demás buscan `(tenant_id=resolved, is_superadmin=false)`.

## Lo que se evita

- **Sin enforcement a nivel DB del tenant_id** (no triggers, no RLS de Postgres). Si el día de mañana queremos Row-Level Security real, se evalúa. Para MVP, app-level es suficiente.
- **Sin tenant en la URL del API**. La URL es `api.rutinex.app/routines`, no `api.rutinex.app/olimpo/routines`. El tenant siempre va por header o JWT. Esto desacopla URL de tenant y permite que el JWT mande.
