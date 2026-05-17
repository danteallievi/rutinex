# 06 — Convenciones del Frontend

## Filosofía

Mobile-first. shadcn/ui como base. Tailwind para todo. Server Components por default, Client Components cuando hace falta interactividad o estado.

## Estructura

```
apps/web/
├── app/
│   ├── page.tsx              # rutinex.app — landing pública
│   ├── signup-form.tsx       # 'use client' — form del landing
│   ├── layout.tsx            # root layout (theme dark, fuentes)
│   ├── globals.css
│   ├── t/                    # tenants — destino del rewrite del middleware
│   │   └── [slug]/
│   │       ├── page.tsx      # "Hoy" del alumno (Step 25+); hoy: bienvenida + branding
│   │       └── not-found.tsx # 404 cuando el slug no existe
│   ├── admin/                # app.rutinex.app — OWNER / TRAINER (Step 20+)
│   └── api/                  # route handlers solo si hace falta (ej. webhooks)
├── components/
│   ├── ui/                   # shadcn/ui generado (Step 20+)
│   └── <dominio>/            # componentes de dominio (RoutineCard, etc.)
├── lib/
│   ├── api-client.ts         # fetch wrapper tipado + ApiClientError
│   ├── env.ts                # acceso tipado a NEXT_PUBLIC_* con guard
│   ├── subdomain.ts          # extractTenantSlug(host)
│   ├── auth.ts               # helpers de auth (cliente) — Step 21+
│   └── utils.ts
├── hooks/
├── middleware.ts             # routing por subdominio
└── postcss.config.mjs        # Tailwind 4 via @tailwindcss/postcss
```

Path alias `@/*` apunta a `apps/web/*` (configurado en `tsconfig.json`).

## Routing por superficie

La detección de host la hace `middleware.ts` (helper `extractTenantSlug` en `lib/subdomain.ts`). El middleware **reescribe** la URL a un prefijo real, **no** a una route group:

| Host                     | Rewrite              | Para qué                    |
| ------------------------ | -------------------- | --------------------------- |
| `rutinex.app/...`        | sin rewrite (`/...`) | Landing pública             |
| `www.rutinex.app/...`    | sin rewrite          | Landing (reservado)         |
| `app.rutinex.app/...`    | `/admin/...`         | Admin (Step 20+, sin rutas) |
| `olimpo.rutinex.app/...` | `/t/olimpo/...`      | Tenant                      |

Por qué no route groups (`(marketing)/(admin)/(student)`): los paréntesis del App Router son organizativos y no aparecen en el URL, así que `NextResponse.rewrite` no puede apuntarles. Detalle en ADR-011.

Las route groups quedan disponibles como herramienta de layout (compartir `layout.tsx` entre rutas hermanas) cuando aparezca esa necesidad. No están prohibidas, simplemente no se usan para mapear hosts a URLs.

## Componentes

### Server vs Client

- Default: **Server Component**.
- `'use client'` solo cuando hay:
  - estado (`useState`, `useReducer`),
  - efectos (`useEffect`),
  - event handlers (onClick, onChange),
  - hooks del browser (router events, etc.).

Patrón: componente "shell" server-side que hace fetch + render, y dentro un client component pequeño para la interactividad. No marcar todo el árbol como client.

### shadcn/ui

Se instalan los componentes a demanda con `pnpm dlx shadcn@latest add button`. Quedan en `components/ui/`. **No** se modifican los archivos shadcn generados directo; si hace falta una variante, se extiende vía `cva`.

> **Estado actual**: el init formal de shadcn (CLI + `components.json`) se difirió al Step 20 para no entreverarlo con la config nueva de Tailwind 4 a mitad del Step 4.5. Hasta entonces, las páginas usan Tailwind directo. Cuando entre Step 20, se inicializa y se refactorizan las que existan.

### Nuestros componentes

- En `components/<dominio>/`. Ej: `components/routines/RoutineCard.tsx`.
- PascalCase.
- Props tipados con interface o type local. Nada de `any`.
- Si un componente crece > 200 líneas, se parte.

## Estado

- **Estado de servidor**: React Query (`@tanstack/react-query`). Cada endpoint del API se consume vía un hook custom (`useRoutines`, `useStudent`, etc.) en `hooks/queries/`.
- **Estado de UI local**: `useState`.
- **Estado global de cliente**: Zustand, solo si aparece la necesidad real (ej. estado de la sesión en curso del alumno). No agregar Zustand para algo que un Context resuelve.

## Llamadas al API

`lib/api-client.ts` expone funciones por endpoint. Cada una construye su request y delega en un helper interno `request<T>(path, init)` que:

- Centraliza el baseUrl (`env.apiUrl` desde `lib/env.ts`).
- Setea `Accept` y `Content-Type: application/json` cuando hay body.
- Si el response es `!2xx`, parsea el JSON de error y lanza un `ApiClientError` con `status` y `body` tipado (`{ statusCode, message, error?, code? }`).
- Si el response es OK, devuelve el JSON tipado como `T`.

Patrón de uso desde un client component:

```ts
import { ApiClientError, createTenant } from '@/lib/api-client';

try {
  const tenant = await createTenant({ slug, name, branding });
} catch (err) {
  if (err instanceof ApiClientError && err.body.code === 'SLUG_TAKEN') {
    // mensaje específico
  }
}
```

Desde un Server Component:

```ts
import { getTenantBySlug } from '@/lib/api-client';
const tenant = await getTenantBySlug(slug);
```

Por endpoint que apunte a datos que cambian seguido y se quieren ver "al toque": pasar `cache: 'no-store'` en el `request` (ya lo hace `getTenantBySlug`).

**A futuro** (cuando entren auth + multi-tenancy guards en Step 8+):

- Cliente adjunta `Authorization: Bearer <accessToken>` desde el store de auth.
- Adjunta `x-tenant-slug` desde el contexto de tenant en surfaces de admin / student.
- Maneja 401 automáticamente: intenta refresh; si falla → logout + redirect a login.

## Env vars en el frontend

Todo lo expuesto al cliente arranca con `NEXT_PUBLIC_*`. `lib/env.ts` las lee con un guard (tira si falta alguna):

```ts
import { env } from '@/lib/env';

env.apiUrl; // NEXT_PUBLIC_API_URL
env.rootHost; // NEXT_PUBLIC_ROOT_HOST (ej. "localhost:3000" en dev)
```

`rootHost` es el host raíz sin protocolo: lo usa el form de signup para redirigir al subdominio del tenant recién creado (`http://${slug}.${rootHost}`).

## Auth (cliente)

- Access token en memoria (React state via Zustand store).
- Refresh token en cookie httpOnly (la setea el API).
- Al cargar la app, intentar refresh silencioso. Si falla → la página de login del surface correspondiente.

## Theming y branding

- Tailwind 4 con CSS variables. La paleta se declara en `app/globals.css` dentro de `:root` + `@theme inline` (no hay `tailwind.config.ts`; Tailwind 4 lee el theme desde el CSS).
- Defaults globales: `--brand-primary`, `--brand-accent`, etc., bajo el theme de Rutinex.
- En la página del tenant (`app/t/[slug]/page.tsx`) se hace fetch del tenant y se setean las CSS vars **scope local** vía `style` en el `<main>`:

  ```tsx
  const cssVars = {
    '--brand-primary': tenant.branding.primaryColor ?? defaultPrimary,
    '--brand-accent': tenant.branding.accentColor ?? defaultAccent,
  } as React.CSSProperties;

  return <main style={cssVars}>{...}</main>;
  ```

- Las utilities Tailwind correspondientes (`bg-brand-primary`, `text-brand-primary`, etc.) se resuelven contra esas vars. Para tonos custom que dependen del color del tenant (badges, bordes con alpha), se usa `style` inline con el valor crudo (`primary`) — Tailwind no genera utilities dinámicas.
- Las superficies admin y marketing usan el theme fijo de Rutinex (sin override).

## Mobile-first

- Diseñar primero la vista mobile.
- Tailwind breakpoints: usar `sm:`, `md:`, `lg:` para agregar layouts más grandes, no para sacar cosas mobile.
- Tap targets mínimos 44x44px.
- Forms: inputs grandes, `inputMode` y `autocomplete` correctos.
- Nada de `:hover` como única affordance.

## Forms

- `react-hook-form` + `zod` para validación.
- Validación cliente espejada de la del API (tipos compartidos vía `packages/shared-types` cuando sea posible).
- Mensajes de error en español.
- En submit: deshabilitar el botón mientras la mutation está in-flight.

## Loading / Error / Empty states

Cada vista de lista o detalle debe contemplar:

1. Loading (skeleton, no spinner full-screen).
2. Error (componente `<ErrorState />` con retry).
3. Empty (componente `<EmptyState />` con CTA contextual).

No hay vista que asuma "siempre hay datos".

## Accesibilidad mínima

- `alt` en todas las imágenes (o `alt=""` si decorativa).
- Labels en todos los inputs.
- Color contrast mínimo AA.
- Focus visible (no `outline: none` sin reemplazo).

## Tests (frontend)

- Componentes de dominio críticos: tests con Vitest + Testing Library.
- E2E con Playwright para 2-3 flujos: login, ejecutar sesión, asignar rutina. Solo en CI.
