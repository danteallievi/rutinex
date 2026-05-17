# 03 — Multi-tenancy

## Estrategia

**Shared database, shared schema, `tenant_id` discriminator column.**

Toda tabla del dominio (excepto `tenants` mismo) tiene una columna `tenant_id` NOT NULL con un FK a `tenants.id` e índice. Todo query la filtra. Punto.

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

Casos (post-implementación de Step 4.5):

| Host                      | Slug        | Resultado                                       |
| ------------------------- | ----------- | ----------------------------------------------- |
| `rutinex.app`             | —           | sin rewrite → landing en `/`                    |
| `www.rutinex.app`         | —           | reservado → landing                             |
| `app.rutinex.app`         | —           | reservado → admin (Step 20+, todavía sin rutas) |
| `olimpo.rutinex.app`      | olimpo      | rewrite `/...` → `/t/olimpo/...`                |
| `olimpo.rutinex.app/foo`  | olimpo      | rewrite `/foo` → `/t/olimpo/foo`                |
| `inexistente.rutinex.app` | inexistente | rewrite a `/t/inexistente`; la page tira 404    |

Reservados (`www`, `app`) y patrones de host que no matchean `*.localhost` / `*.rutinex.app` no se tratan como tenant. Ver código en `apps/web/lib/subdomain.ts`.

Por qué reescribir a un prefijo real y no a una route group (`(student)/`): las route groups del App Router son organizativas y no aparecen en el URL path, así que `NextResponse.rewrite` no puede apuntarles. Detalle en ADR-011.

### URLs de dev

Chrome y Firefox resuelven `*.localhost` automáticamente. No hace falta tocar `/etc/hosts`. Si en Safari aparece algún problema, usar `*.lvh.me` o `*.localtest.me` como host alternativo (todos resuelven a `127.0.0.1`).

```
http://localhost:3000               → landing
http://olimpo.localhost:3000        → tenant "olimpo" (rewrite a /t/olimpo)
http://www.localhost:3000           → landing (reservado)
http://inexistente.localhost:3000   → 404 "Este gimnasio no existe"
```

### CORS

En dev, el API (`apps/api/src/main.ts`) habilita CORS con regex para `localhost` y `*.localhost` en cualquier puerto. Esto cubre el flujo de signup en la landing (`localhost:3000`) y los fetches server-side de la página del tenant (`<slug>.localhost:3000`).

En prod (Step 27) el origin se restringe a `rutinex.app` y `*.rutinex.app`.

### Validación en el API

El frontend manda `x-tenant-slug: olimpo` en cada request al API. El API tiene un `TenantGuard` global que:

1. Si la ruta es pública (signup, login del owner desde landing, healthcheck), no hace nada.
2. Si la ruta es autenticada:
   a. Extrae `userId` y `tenantId` del JWT.
   b. Lee `x-tenant-slug` del header.
   c. Carga el tenant por slug y compara `tenant.id === jwt.tenantId`.
   d. Si no coincide → `403 Forbidden`. (Defensa contra alguien que se logueó en un tenant y trata de pegarle a otro.)
   e. Inyecta `tenantId` en el `Request` para que los services lo usen.

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
- Reservados (chocan con superficies propias del producto y se rechazan en `POST /tenants` con 409 `SLUG_RESERVED`):
  `admin`, `api`, `app`, `assets`, `auth`, `docs`, `help`, `mail`, `rutinex`, `static`, `status`, `support`, `www`.
- Inmutable después de creado. Si un cliente lo quiere cambiar, soporte lo hace manualmente y vemos cómo migrar referencias (rarísimo).
- Fuente de verdad en código: `apps/api/src/modules/tenants/slug.ts` (constantes + función `isReservedSlug`). El DTO valida regex + longitud (400) y el service valida reservado + colisión (409).

## Casos borde

- **OWNER se loguea desde `app.rutinex.app`**: el flujo de login en admin pide email + password sin slug. El API busca el `user` por email, encuentra su `tenant_id`, emite JWT con ese `tenant_id`. Si el mismo email existe en varios tenants (raro, pero permitido), se pide que ingresen el slug también.
- **STUDENT se loguea desde `olimpo.rutinex.app`**: el slug viene del subdominio. El API busca `user` por email + `tenant_id` resuelto desde slug. Más simple.
- **STUDENT entra a un slug que no existe**: 404 con página genérica.
- **STUDENT entra a `olimpo.rutinex.app` con un JWT de otro tenant**: el `TenantGuard` lo rechaza. El frontend lo desloguea y lo manda al login de `olimpo`.

## Lo que se evita

- **Sin enforcement a nivel DB del tenant_id** (no triggers, no RLS de Postgres). Si el día de mañana queremos Row-Level Security real, se evalúa. Para MVP, app-level es suficiente.
- **Sin tenant en la URL del API**. La URL es `api.rutinex.app/routines`, no `api.rutinex.app/olimpo/routines`. El tenant siempre va por header o JWT. Esto desacopla URL de tenant y permite que el JWT mande.
