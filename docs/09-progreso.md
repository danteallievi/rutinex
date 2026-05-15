# 09 — Progreso

Estado actual del proyecto. Este archivo lo mantiene Claude Code (y vos) actualizado paso a paso. Es lo primero que se lee al retomar.

## Estado general

**Fase actual**: Fase 0 — Setup del repo.
**Paso actual**: Step 1 completo. Próximo: Step 2 — Linting, formatting, hooks.
**Última actualización**: 2026-05-13 — Step 1 (monorepo skeleton) completado.

## Pasos completados

### Step 1 — Monorepo skeleton (2026-05-13)
Monorepo pnpm workspaces con `apps/api` (NestJS 11), `apps/web` (Next 15.5.18 + React 19.1 + Tailwind 4 + App Router) y `packages/shared-types` (vacío, listo para tipos compartidos). `pnpm install` corre limpio en la raíz; `pnpm api:dev` levanta `GET / → "Hello World!"`; `pnpm web:dev` levanta la página default de Next.
Archivos clave: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `.nvmrc`, `.npmrc`, `apps/api/*`, `apps/web/*`, `packages/shared-types/*`.
Notas:
- Se ignoró Next 16 (recién salido) y se fijó Next 15 para mantener ADR-006/009 y el roadmap pensado para Next 15.
- Tsconfigs de api y web ya tienen `strict: true` y `noUncheckedIndexedAccess: true`.
- `next.config.ts` fija `turbopack.root` al root del monorepo para evitar el warning de lockfiles ambiguos.
- `pnpm.onlyBuiltDependencies` en el root permite los install scripts de `sharp`, `unrs-resolver`, `@swc/core`, `@nestjs/core`, `@tailwindcss/oxide`, `esbuild` (los que pnpm 10 bloquea por default).
- Las docs estaban sueltas en el root: se movieron a `docs/` para alinear con los crosslinks del `CLAUDE.md`.

## Próxima acción concreta

Step 2 — Linting, formatting, hooks. Criterios y detalle en `docs/07-roadmap.md`.

## Pendientes / deudas técnicas

_(Vacío.)_

## Decisiones pendientes (necesitan input humano)

- **Plan de billing**: si es mensual fijo por trainer o por alumno activo. No es bloqueante hasta fase 2 (step ~28+).
- **Custom domains**: si y cuándo soportar `app.gimnasioX.com.ar` apuntando a Rutinex. Diferido.
- **Catálogo global de ejercicios**: en MVP cada tenant tiene su catálogo. Si más adelante queremos un catálogo curado por nosotros, hay que pensar el merge. Diferido.

## Notas para retomar

- Si volvés y no recordás dónde quedaste, leé este archivo de arriba abajo. Si "Paso actual" no matchea con el código (ej. está marcado "Step 5" pero ya hay refresh tokens implementados), confiá en el código y corregí este archivo.
- Si la última sesión cortó a mitad de un step, debería haber commit `wip(step N): ...` en una branch y una lista checkbox abajo con lo hecho/falta. Si no la hay y el repo está sucio, primero entendé qué pasó (git status, git log) y reconciliá.
