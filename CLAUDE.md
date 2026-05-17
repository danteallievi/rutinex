# CLAUDE.md — Guía para Claude Code

Este archivo es lo primero que tenés que leer al abrir este repo.

## Qué es este proyecto

Rutinex es una plataforma SaaS multi-tenant para gimnasios y personal trainers. Cada tenant (gym/PT) tiene su propio subdominio y branding. Los entrenadores arman rutinas y se las asignan a alumnos; los alumnos las ejecutan y trackean su progreso.

Para entender el dominio completo, leé `docs/02-dominio.md`. Para entender la arquitectura, `docs/01-arquitectura.md`.

## Cómo trabajar en este repo

### 1. Leé las docs antes de codear

Antes de tocar código, leé las docs relevantes a la tarea. La fuente de verdad del proyecto vive en `/docs`, no en el código. Si una doc y el código se contradicen, **la doc gana** (y hay que arreglar el código), salvo que sea evidente que la doc quedó desactualizada — en cuyo caso primero actualizá la doc, después el código.

Mapa rápido:

| Si vas a tocar...                          | Leé primero...                               |
| ------------------------------------------ | -------------------------------------------- |
| Entidades, relaciones, schema de DB        | `docs/02-dominio.md`                         |
| Auth, login, JWT, registro                 | `docs/04-auth.md`                            |
| Resolución de tenant, subdominio, branding | `docs/03-multi-tenancy.md`                   |
| Endpoints, DTOs, validación, errores       | `docs/05-api-conventions.md`                 |
| Componentes, páginas, estado en Next       | `docs/06-frontend-conventions.md`            |
| Qué hacer ahora / qué sigue                | `docs/07-roadmap.md` y `docs/09-progreso.md` |
| Por qué se decidió X de tal forma          | `docs/08-decisiones.md`                      |

### 2. Auto-documentación

Este repo se auto-documenta. Cada tipo de cambio dispara una actualización de documentación específica. Las reglas viven en `docs/00-autodocumentacion.md`. **Leelas. No son opcionales.**

Resumen:

- Agregás/modificás una entidad → actualizá `docs/02-dominio.md`
- Tomás una decisión arquitectónica → agregá un ADR en `docs/08-decisiones.md`
- Cerrás un paso del roadmap → marcalo en `docs/09-progreso.md`
- Agregás un endpoint nuevo que rompe una convención → actualizá `docs/05-api-conventions.md`

### 3. Flujo por paso

El roadmap (`docs/07-roadmap.md`) está dividido en pasos numerados. Cada paso tiene criterios de aceptación claros. Trabajá **un paso a la vez**:

1. Identificá el paso actual en `docs/09-progreso.md`.
2. Leé los criterios de aceptación de ese paso en el roadmap.
3. Leé las docs relevantes (ver tabla arriba).
4. Implementá.
5. Verificá los criterios de aceptación.
6. Actualizá `docs/09-progreso.md` marcando el paso como completo y, si corresponde, agregá un ADR en `docs/08-decisiones.md`.
7. Hacé commit con mensaje `step(N): descripción corta`.
8. Pausá y avisame el resultado antes de seguir con el próximo paso, usando el **formato de cierre de step** (abajo).

### Formato de cierre de step

Al terminar el commit del step, respondé breve y conciso, en tres secciones:

1. **Resumen** — 1-3 líneas de qué quedó hecho (el detalle largo vive en `docs/09-progreso.md`, no lo repitas acá).
2. **Visible en la web** — qué puede ver el usuario navegando la web (`pnpm web:dev`). Si el step es backend puro y no hay nada nuevo visible, decilo explícito ("nada nuevo — backend puro").
3. **Prompt para la próxima sesión** — un bloque listo para copiar/pegar que arranque el siguiente step: orden de docs a leer, criterios de aceptación clave, y cualquier regla específica de ese step.

Nada más. Sin "qué aprendí", sin re-explicar el plan, sin pedir confirmación. El usuario corta o sigue.

**Importante**: si los tokens se están por acabar a mitad de un paso, dejá `docs/09-progreso.md` en un estado que describa exactamente qué quedó hecho y qué falta. La próxima sesión tiene que poder retomar leyendo ese archivo.

## Convenciones de código (resumen)

Las convenciones completas viven en `docs/05-api-conventions.md` y `docs/06-frontend-conventions.md`. Resumen mínimo:

- **TypeScript estricto** en todo el monorepo. `strict: true`, `noUncheckedIndexedAccess: true`.
- **Lint y formato**: ESLint flat config en `eslint.config.mjs` (raíz) y Prettier en `.prettierrc`. `pnpm lint` y `pnpm format` corren desde la raíz; el pre-commit hook (husky + lint-staged) autoformatea los archivos staged. No bypassees el hook con `--no-verify`.
- **Validación**: en el API, `class-validator` + `class-transformer` en todos los DTOs.
- **Errores**: usar las excepciones de NestJS (`NotFoundException`, etc.) y dejar que el filtro global las formatee.
- **Naming**: `kebab-case` para archivos y carpetas, `PascalCase` para clases/componentes, `camelCase` para variables/funciones.
- **Tests**: cada módulo del API tiene `*.spec.ts` para servicios. Tests E2E para flujos críticos (auth, asignación de rutina, tracking).
- **Commits**: prefijo `step(N): ...` para pasos del roadmap, o `fix:`, `feat:`, `docs:`, `refactor:` para cambios sueltos.

## Stack y versiones

- Node.js 22 LTS
- pnpm 9+
- NestJS 11
- TypeORM 0.3
- PostgreSQL 16
- Next.js 15 (App Router)
- React 19
- Tailwind 4
- shadcn/ui

Para el detalle de por qué cada elección, ver `docs/08-decisiones.md`.

## Qué NO hacer

- **No** introduzcas un servicio nuevo sin un ADR previo en `docs/08-decisiones.md`.
- **No** uses bibliotecas pagas (Clerk, Auth0, etc.). El proyecto se mantiene en infra mínima/gratuita.
- **No** asumas que sabés el siguiente paso: leé el roadmap.
- **No** dejes `console.log` en el código. Usá el logger de NestJS (`Logger` de `@nestjs/common`) en backend y `console.warn`/`console.error` solo donde tenga sentido en frontend.
- **No** hagas migraciones automáticas de TypeORM en producción (`synchronize: false`). Siempre migraciones explícitas.
- **No** rompas el contrato de subdominio: cada request al API que vive en contexto de tenant debe tener el `tenant_id` resuelto antes de tocar la DB.

## Primer comando si abrís el repo y no sabés dónde estás

```bash
cat docs/09-progreso.md
```

Eso te dice en qué paso está el proyecto y qué hacer a continuación.
