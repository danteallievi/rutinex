# 06 — Convenciones del Frontend

## Filosofía

Mobile-first. shadcn/ui como base. Tailwind para todo. Server Components por default, Client Components cuando hace falta interactividad o estado.

## Estructura

```
apps/web/
├── app/
│   ├── (marketing)/          # rutinex.app — landing pública
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── signup/
│   │   └── pricing/
│   ├── (admin)/              # app.rutinex.app — OWNER / TRAINER
│   │   ├── layout.tsx
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── students/
│   │   ├── exercises/
│   │   └── routines/
│   ├── (student)/            # <slug>.rutinex.app — STUDENT
│   │   ├── layout.tsx        # lee tenant, aplica branding
│   │   ├── login/
│   │   ├── page.tsx          # "Hoy"
│   │   ├── history/
│   │   ├── exercises/[id]/
│   │   └── session/[id]/
│   └── api/                  # route handlers solo si hace falta (ej. webhooks)
├── components/
│   ├── ui/                   # shadcn/ui generado
│   └── <dominio>/            # componentes de dominio (RoutineCard, etc.)
├── lib/
│   ├── api-client.ts         # fetch wrapper tipado
│   ├── auth.ts               # helpers de auth (cliente)
│   ├── tenant.ts             # helpers de tenant
│   └── utils.ts
├── hooks/
├── middleware.ts             # routing por subdominio
└── tailwind.config.ts
```

## Routing por superficie

La detección de host (`rutinex.app` vs `app.rutinex.app` vs `<slug>.rutinex.app`) la hace `middleware.ts`. El middleware **reescribe** la URL al grupo correcto:

- Host `rutinex.app` → rewrite a `/(marketing)/...`
- Host `app.rutinex.app` → rewrite a `/(admin)/...`
- Host `<slug>.rutinex.app` → rewrite a `/(student)/...` y agrega header `x-tenant-slug`.

Esto permite que las URLs públicas sean limpias (`olimpo.rutinex.app/hoy`) pero el código viva en grupos separados.

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

`lib/api-client.ts` exporta un cliente tipado:

```ts
import { apiClient } from '@/lib/api-client';

const routines = await apiClient.get<RoutineResponseDto[]>('/routines');
```

El cliente:

- Adjunta `Authorization: Bearer <accessToken>` desde el store de auth.
- Adjunta `x-tenant-slug` desde el contexto de tenant (en surfaces de admin y student).
- Maneja 401 automáticamente: intenta refresh, si falla → logout + redirect a login.
- Centraliza el baseUrl (`process.env.NEXT_PUBLIC_API_URL`).

## Auth (cliente)

- Access token en memoria (React state via Zustand store).
- Refresh token en cookie httpOnly (la setea el API).
- Al cargar la app, intentar refresh silencioso. Si falla → la página de login del surface correspondiente.

## Theming y branding

- Tailwind 4 con CSS variables.
- En el layout del student, leer `tenant.branding` y setear:
  ```tsx
  <html style={{
    '--brand-primary': branding.primaryColor,
    '--brand-accent': branding.accentColor,
  }}>
  ```
- En `tailwind.config.ts`:
  ```ts
  colors: {
    brand: {
      primary: 'var(--brand-primary)',
      accent: 'var(--brand-accent)',
    }
  }
  ```
- Usar `bg-brand-primary`, `text-brand-primary` en componentes del student.
- Las superficies admin y marketing tienen branding fijo de Rutinex (sin override).

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
