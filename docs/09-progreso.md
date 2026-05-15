# 09 — Progreso

Estado actual del proyecto. Este archivo lo mantiene Claude Code (y vos) actualizado paso a paso. Es lo primero que se lee al retomar.

## Estado general

**Fase actual**: Fase 0 — Setup del repo.
**Paso actual**: Step 2 completo. Próximo: Step 3 — Conexión a DB + primera entity.
**Última actualización**: 2026-05-14 — Step 2 (linting, formatting, hooks) completado.

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

### Step 2 — Linting, formatting, hooks (2026-05-14)

ESLint flat config único en `eslint.config.mjs` (raíz) compartido por `apps/api` y `apps/web`. Prettier config raíz (`.prettierrc` + `.prettierignore`). `husky` v9 con `.husky/pre-commit` que corre `pnpm exec lint-staged`. Configuración de lint-staged en `.lintstagedrc.json`: eslint --fix + prettier --write para TS/JS, prettier para JSON/MD/CSS/YAML.

Scripts raíz: `pnpm lint` (`eslint .`), `pnpm lint:fix`, `pnpm format` (`prettier --write .`), `pnpm format:check`, `pnpm prepare` (husky). `pnpm lint` corre con 0 errors y 0 warnings; `pnpm format:check` confirma que todos los archivos están en estilo.

Archivos clave: `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `.lintstagedrc.json`, `.husky/pre-commit`, scripts en `package.json` raíz.

Notas:

- Reglas type-checked (`tseslint.configs.recommendedTypeChecked`) sólo aplican a `apps/api/**/*.ts`, con `projectService: true` apuntando a `apps/api`.
- En `apps/web/**` se usa `next/core-web-vitals` + `next/typescript` vía `FlatCompat`. Se setea `settings.next.rootDir = 'apps/web/'` para que el rule `no-html-link-for-pages` no busque `pages/` en el root del monorepo.
- Se eliminaron las configs duplicadas de Next: `apps/api/eslint.config.mjs`, `apps/api/.prettierrc` y `apps/web/eslint.config.mjs`. Si más adelante hace falta un override per-app, vivirá en la raíz con un glob `files`.
- `apps/api/src/main.ts`: `bootstrap();` pasó a `void bootstrap();` para satisfacer `@typescript-eslint/no-floating-promises` de forma explícita.
- Husky v9 escribe el hooks path en `.husky/_`; el hook real es `.husky/pre-commit`. `pnpm prepare` lo reinstala en cada `pnpm install`.
- Verificación del hook: se commiteó un archivo deformado (`apps/api/src/_lint_probe.ts` con `"deformed"` y espacios sueltos) y lint-staged lo reformateó a `'deformed'` con semi-colon antes de quedar incluido en el commit. Después se descartó el commit de prueba.
- Limpieza de deuda: se quitaron `baseUrl` (y `paths` no usados) de `tsconfig.base.json` y `apps/api/tsconfig.json` (deuda heredada de `nest new`).

## Próxima acción concreta

Step 3 — Conexión a DB + primera entity. Criterios y detalle en `docs/07-roadmap.md`.

## Pendientes / deudas técnicas

_(vacío — `baseUrl` deprecado quedó saldado en Step 2.)_

## Decisiones pendientes (necesitan input humano)

- **Plan de billing**: si es mensual fijo por trainer o por alumno activo. No es bloqueante hasta fase 2 (step ~28+).
- **Custom domains**: si y cuándo soportar `app.gimnasioX.com.ar` apuntando a Rutinex. Diferido.
- **Catálogo global de ejercicios**: en MVP cada tenant tiene su catálogo. Si más adelante queremos un catálogo curado por nosotros, hay que pensar el merge. Diferido.

## Notas para retomar

- Si volvés y no recordás dónde quedaste, leé este archivo de arriba abajo. Si "Paso actual" no matchea con el código (ej. está marcado "Step 5" pero ya hay refresh tokens implementados), confiá en el código y corregí este archivo.
- Si la última sesión cortó a mitad de un step, debería haber commit `wip(step N): ...` en una branch y una lista checkbox abajo con lo hecho/falta. Si no la hay y el repo está sucio, primero entendé qué pasó (git status, git log) y reconciliá.
