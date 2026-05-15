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

Pseudo-código:

```ts
export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const subdomain = extractSubdomain(host);

  // Casos:
  // host = "rutinex.app"          → landing pública, no tenant
  // host = "app.rutinex.app"      → admin (OWNER/TRAINER), tenant viene del JWT
  // host = "olimpo.rutinex.app"   → tenant slug = "olimpo"

  if (!subdomain || subdomain === 'app' || subdomain === 'www') {
    return NextResponse.next(); // landing o admin
  }

  // Tenant slug. Lo pasamos como header a la app y como cookie para hidratación cliente.
  const res = NextResponse.next();
  res.headers.set('x-tenant-slug', subdomain);
  return res;
}
```

El layout del segmento de alumno (`apps/web/app/(student)/layout.tsx`) lee el header y carga el branding del tenant antes de renderizar.

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

El frontend lo lee en el layout del alumno y lo aplica vía CSS variables:

```tsx
<html style={{
  '--brand-primary': branding.primaryColor,
  '--brand-accent': branding.accentColor,
}}>
```

Tailwind se configura para leer esas variables (`tailwind.config.ts` extends con `colors.brand.primary = 'var(--brand-primary)'`).

## Slug del tenant

- Match: `^[a-z0-9](-[a-z0-9]+)*$` (DNS-safe).
- Mínimo 3 caracteres, máximo 30.
- Reservados: `www`, `api`, `app`, `admin`, `mail`, `assets`, `static`, `rutinex`, `support`, `help`, `docs`, `status`. Se rechazan en signup.
- Inmutable después de creado. Si un cliente lo quiere cambiar, soporte lo hace manualmente y vemos cómo migrar referencias (rarísimo).

## Casos borde

- **OWNER se loguea desde `app.rutinex.app`**: el flujo de login en admin pide email + password sin slug. El API busca el `user` por email, encuentra su `tenant_id`, emite JWT con ese `tenant_id`. Si el mismo email existe en varios tenants (raro, pero permitido), se pide que ingresen el slug también.
- **STUDENT se loguea desde `olimpo.rutinex.app`**: el slug viene del subdominio. El API busca `user` por email + `tenant_id` resuelto desde slug. Más simple.
- **STUDENT entra a un slug que no existe**: 404 con página genérica.
- **STUDENT entra a `olimpo.rutinex.app` con un JWT de otro tenant**: el `TenantGuard` lo rechaza. El frontend lo desloguea y lo manda al login de `olimpo`.

## Lo que se evita

- **Sin enforcement a nivel DB del tenant_id** (no triggers, no RLS de Postgres). Si el día de mañana queremos Row-Level Security real, se evalúa. Para MVP, app-level es suficiente.
- **Sin tenant en la URL del API**. La URL es `api.rutinex.app/routines`, no `api.rutinex.app/olimpo/routines`. El tenant siempre va por header o JWT. Esto desacopla URL de tenant y permite que el JWT mande.
