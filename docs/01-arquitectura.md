# 01 — Arquitectura

## Vista de pájaro

```
┌─────────────────────────────────────────────────────────────────┐
│                          Internet                                │
└────────────────────┬────────────────────┬───────────────────────┘
                     │                    │
            *.rutinex.app          api.rutinex.app
                     │                    │
                ┌────▼─────┐         ┌────▼──────┐
                │  Vercel  │         │  Railway  │
                │ (Next 15)│◄────────│  (NestJS) │
                └────┬─────┘   HTTPS └────┬──────┘
                     │                    │
                     │                    │
                     │              ┌─────▼──────┐
                     │              │ PostgreSQL │
                     │              │   (Neon)   │
                     │              └────────────┘
                     │
                     │              ┌────────────┐
                     └─────────────►│ Cloudflare │
                       videos/gifs  │     R2     │
                                    └────────────┘
```

## Componentes

### `apps/api` — Backend NestJS

Monolito modular. Un solo proceso, una sola base de datos, módulos independientes con bordes claros.

Módulos previstos:

| Módulo        | Responsabilidad                                                                  |
| ------------- | -------------------------------------------------------------------------------- |
| `auth`        | Login (staff + student por DNI), refresh, change-password, guards JWT/Superadmin |
| `tenants`     | Resolución por subdominio, branding (CRUD vive bajo `superadmin`)                |
| `superadmin`  | Panel del operador de Rutinex: crear tenants + OWNER, toggle activo, branding    |
| `users`       | Usuarios (OWNER, TRAINER, STUDENT, SUPERADMIN), perfil, estado activo/inactivo   |
| `exercises`   | Catálogo de ejercicios (título, descripción, media URL)                          |
| `routines`    | Rutinas y items de rutina (ejercicios con series/reps prescritas)                |
| `assignments` | Asignación rutina ↔ alumno con fecha de vigencia                                 |
| `sessions`    | Ejecución de una rutina por parte de un alumno en una fecha                      |
| `tracking`    | Sets ejecutados (reps reales, peso real) y personal records                      |
| `comments`    | Comentarios del alumno sobre ejercicios (fase 2: visible al PT)                  |
| `media`       | Subida y firma de URLs para videos/gifs en R2                                    |
| `billing`     | Stub para fase 2. Suscripciones del entrenador                                   |

### `apps/web` — Frontend Next.js

App Router. Mobile-first con Tailwind. shadcn/ui como base de componentes.

Superficies lógicas dentro de una sola app Next (modelo sales-led — ver ADR-012):

| Superficie               | Host                     | Para quién                                                          |
| ------------------------ | ------------------------ | ------------------------------------------------------------------- |
| Landing comercial        | `rutinex.app`            | Visitantes (CTA WhatsApp, sin signup público)                       |
| Panel SUPERADMIN         | `superadmin.rutinex.app` | Operadores de Rutinex (crean tenants, resetean passwords)           |
| Tenant (admin + student) | `<tenant>.rutinex.app`   | OWNER/TRAINER (post-login → admin) y STUDENT (post-login → student) |

La distinción la hace un middleware Next que lee el host del request y reescribe a un prefijo real (`/superadmin/...` o `/t/:slug/...`). Ver `docs/03-multi-tenancy.md`.

### `packages/shared-types`

Tipos y enums compartidos entre `api` y `web`. Ejemplos: enum de roles, DTOs públicos, tipos de tracking. **No** contiene lógica, solo tipos.

## Decisiones arquitectónicas resumidas

- **Monolito modular, no microservicios**. Hasta que haya una razón concreta (escala, equipos separados), un proceso. Ver ADR-001.
- **Multi-tenancy con shared DB + `tenant_id`**. Ver ADR-002 y `docs/03-multi-tenancy.md`.
- **Auth propia con Passport JWT**. Ver ADR-003 y `docs/04-auth.md`.
- **Storage de media en R2** por costo (Cloudflare R2 no cobra egress). Ver ADR-004.
- **Migraciones TypeORM explícitas**, nunca `synchronize: true`. Ver ADR-005.

(Los ADRs viven en `docs/08-decisiones.md`.)

## Flujo de una request típica

Ejemplo: alumno entra a `olimpo.rutinex.app/rutina-hoy`.

1. DNS resuelve `*.rutinex.app` a Vercel.
2. Middleware Next lee el host, extrae `olimpo`, lo inyecta como header `x-tenant-slug` y como contexto en el layout.
3. El layout del alumno hace fetch a `api.rutinex.app/sessions/today` con:
   - `Authorization: Bearer <jwt>`
   - `x-tenant-slug: olimpo`
4. El API valida el JWT, extrae el `userId` y `tenantId` del token, y verifica que el `tenant_slug` del header coincida con el `tenantId` del token. Si no coincide, 403.
5. El controller llama al service, que filtra por `tenantId` automáticamente vía un guard/interceptor global.
6. Devuelve la sesión del día.

**Regla de oro**: ningún query SQL que toque una tabla con `tenant_id` puede ejecutarse sin filtrar por `tenant_id`. Esto se enforza con un repositorio base que rechaza queries sin ese filtro. Detalle en `docs/03-multi-tenancy.md`.

## Lo que NO está en la arquitectura (y por qué)

- **Sin Redis** al inicio. No lo necesitamos para nada crítico todavía. Cuando aparezca rate limiting serio o cache de sesiones, se agrega.
- **Sin colas de mensajes** (BullMQ, etc.). Los mails de invitación se mandan in-process al principio. Cuando duela, agregamos.
- **Sin CDN propia para frontend** (Vercel ya da CDN).
- **Sin observabilidad cara** (Datadog, etc.). Logs a stdout, Railway/Fly los retiene unos días. Pino como logger.
