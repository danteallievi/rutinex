# Rutinex

Plataforma SaaS multi-tenant para que gimnasios y personal trainers de Argentina/LATAM digitalicen la gestión de rutinas con sus alumnos, en español, en pesos, y con branding propio por subdominio.

## ¿Qué es?

Cada gimnasio o entrenador tiene su propio subdominio (`olimpo.rutinex.app`, `juanperez.rutinex.app`). Desde ahí, el entrenador da de alta a sus alumnos, arma rutinas con ejercicios (título, descripción, video/gif explicativo), y se las asigna. El alumno entra a la web de su entrenador, ve la rutina del día, navega cada ejercicio, trackea series/reps/pesos y registra sus personal records.

## Stack

- **Backend**: NestJS + TypeORM + PostgreSQL (monolito modular)
- **Frontend**: Next.js 15 + TypeScript + Tailwind + shadcn/ui (mobile-first)
- **Auth**: Propia, NestJS Passport + JWT + refresh tokens + Argon2
- **Multi-tenancy**: shared DB con `tenant_id`, routing por subdominio vía middleware Next
- **Monorepo**: pnpm workspaces (`apps/api`, `apps/web`, `packages/shared-types`)

## Estructura del repo

```
rutinex/
├── apps/
│   ├── api/                  # NestJS backend
│   └── web/                  # Next.js frontend
├── packages/
│   └── shared-types/         # Tipos compartidos (DTOs, enums)
├── docs/
│   ├── 00-autodocumentacion.md
│   ├── 01-arquitectura.md
│   ├── 02-dominio.md
│   ├── 03-multi-tenancy.md
│   ├── 04-auth.md
│   ├── 05-api-conventions.md
│   ├── 06-frontend-conventions.md
│   ├── 07-roadmap.md
│   ├── 08-decisiones.md
│   └── 09-progreso.md
├── CLAUDE.md                 # Guía para Claude Code
└── README.md                 # Este archivo
```

## Inicio rápido

Pendiente — se completa cuando esté el primer scaffolding funcional (ver `docs/09-progreso.md`).

## Documentación

La fuente de verdad del proyecto vive en `/docs`. Toda decisión técnica relevante queda registrada en `docs/08-decisiones.md` (ADRs). El estado de avance se mantiene en `docs/09-progreso.md`.

Si abrís el repo con Claude Code, leé primero `CLAUDE.md`.
