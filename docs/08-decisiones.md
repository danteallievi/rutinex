# 08 — Decisiones (ADRs)

Cada decisión arquitectónica relevante queda registrada acá con este formato:

- **Contexto**: qué problema se está resolviendo.
- **Opciones**: qué alternativas se evaluaron.
- **Decisión**: qué se eligió.
- **Razón**: por qué.
- **Consecuencias**: qué implica, qué dolería revertir.

---

## ADR-001 — Monolito modular en lugar de microservicios

**Contexto**: Toto viene trabajando con microservicios en el laburo. La tentación inicial es replicar el patrón. Para Rutinex, el equipo es de 1-2 personas y el negocio no existe todavía.

**Opciones**:
- Microservicios desde día 1 (auth-service, routines-service, etc.).
- Monolito sin estructura.
- Monolito **modular** (un proceso, módulos NestJS con bordes claros).

**Decisión**: monolito modular.

**Razón**:
- Microservicios introducen complejidad operativa (deploy, comunicación, observabilidad) que no se justifica con 1-2 devs y 0 usuarios.
- NestJS hace el módulo monolítico naturalmente modular: cada módulo tiene su API pública (provider exports) y sus internals.
- Si en el futuro un módulo necesita escalar aparte, se extrae. La extracción de un módulo NestJS bien aislado es razonable.

**Consecuencias**:
- Un único deploy. Un downtime afecta todo.
- DB compartida → cuidado con queries cross-módulo. Política: un módulo no consulta tablas de otro directamente, llama al service del otro módulo.
- Si llega un caso real que justifique split (ej. el módulo `media` con upload/processing pesado), se extrae con un evento o cola.

---

## ADR-002 — Multi-tenancy con shared DB + tenant_id

**Contexto**: el producto es multi-tenant. Hay tres estrategias clásicas: DB-per-tenant, schema-per-tenant, shared-DB con discriminator.

**Opciones**:
- DB-per-tenant: máxima aislación, máximo costo operativo (provisioning, migraciones, backups).
- Schema-per-tenant: aislación intermedia, migraciones se aplican N veces.
- Shared DB + `tenant_id`: una sola DB, todas las tablas con columna `tenant_id`, filtrado a nivel app.

**Decisión**: shared DB + `tenant_id`.

**Razón**:
- Infra mínima: una sola Postgres maneja N tenants sin esfuerzo hasta miles.
- Migraciones simples: una sola pasada.
- Cuando aparezca un cliente que exija aislación real (compliance), se puede mover ese tenant a su propio schema sin tocar el resto.

**Consecuencias**:
- Riesgo principal: query que olvida filtrar por `tenant_id` y filtra datos cruzados. Mitigado con `TenantScopedRepository` y guards. Ver `docs/03-multi-tenancy.md`.
- Backups: no se puede restaurar un solo tenant fácil. Mitigado: backups por tabla con filtros (script ad-hoc cuando haga falta).
- Reportes cross-tenant baratos (somos los admins, vemos todo).

---

## ADR-003 — Auth propia (Passport JWT + Argon2) en lugar de Clerk/Auth0

**Contexto**: el laburo de Toto usa Clerk. Para Rutinex, Clerk costaría desde ~USD 25/mes pasando el free tier, y agrega un punto de falla externo.

**Opciones**:
- Clerk: hosted, completo, pago en escala.
- Auth0: similar, también pago.
- better-auth (open source, self-hosted): gratis pero centrado en Next.js.
- Passport + JWT propio en NestJS.

**Decisión**: Passport + JWT propio en NestJS.

**Razón**:
- Costo: 0.
- En NestJS, Passport es el patrón canónico, hay docs abundantes y comportamiento conocido.
- Multi-tenancy custom: nuestro auth tiene que ser tenant-aware (mismo email en distintos tenants es válido). Implementarlo en Clerk requiere maniobras. En propio, es natural.
- Argon2id es el estándar OWASP 2024.

**Consecuencias**:
- Más superficie de seguridad propia. Mitigaciones: rate limiting, no revelar existencia de usuarios, refresh tokens revocables, detección de reuso.
- Sin features automáticos (passwordless, social login, WebAuthn). Si los queremos, los implementamos. Aceptable para MVP.

---

## ADR-004 — Cloudflare R2 para media

**Contexto**: gifs/videos de ejercicios necesitan storage. S3 cobra egress, que para video se vuelve caro rápido.

**Opciones**:
- S3 / AWS.
- Cloudflare R2: API S3-compatible, sin egress fees.
- Backblaze B2: similar.
- Subir todo a YouTube/Vimeo unlisted.

**Decisión**: Cloudflare R2.

**Razón**:
- Sin egress fees. Costo predecible incluso si los alumnos ven mucho video.
- API S3-compatible: cualquier SDK de AWS funciona apuntándole.
- Plan gratis incluye 10GB/mes; con eso arranca cómodo.

**Consecuencias**:
- Otra cuenta más en el stack (Cloudflare).
- Si en algún momento queremos transcoding, no lo tiene built-in (sí lo tiene Cloudflare Stream, pero es pago). Aceptable: los trainers suben gifs livianos o el video que ellos quieran.

---

## ADR-005 — Migraciones explícitas, nunca `synchronize: true`

**Contexto**: TypeORM puede generar el schema automáticamente con `synchronize: true`, pero la realidad de DB en prod requiere control.

**Decisión**: `synchronize: false` siempre. Migraciones generadas con `migration:generate`, revisadas, commiteadas y aplicadas explícitamente.

**Razón**:
- En prod nunca queremos cambios automáticos.
- En dev queremos que las migraciones reflejen la realidad para que no haya drift.
- Si en dev `synchronize` arregla "mágicamente" un cambio, dev y prod se desincronizan rápido.

**Consecuencias**:
- Cada cambio de schema implica `migration:generate`. Bien.
- Toto y su amigo tienen que correr migraciones al pull. `pnpm --filter api migration:run` antes de levantar.

---

## ADR-006 — Stack frontend: Next 15 + Tailwind 4 + shadcn/ui

**Contexto**: necesitamos web mobile-first, deploy barato, server components.

**Decisión**: Next 15 App Router + Tailwind 4 + shadcn/ui.

**Razón**:
- Next 15 + Vercel: free tier alcanza para arrancar.
- App Router con Server Components: menos JS al cliente, mejor perf en mobile.
- Tailwind 4: utility-first conocido, sin runtime overhead.
- shadcn/ui: componentes copiados a tu repo (no dependency), Toto ya lo conoce del LoL Draft Assistant.

**Consecuencias**:
- Next es opinated y cambia rápido entre majors. Aceptable; nos quedamos en 15 hasta que haya razón clara para subir.

---

## ADR-007 — pnpm workspaces para el monorepo

**Contexto**: necesitamos compartir tipos entre backend y frontend, y mantener una sola CI.

**Opciones**: npm workspaces, yarn workspaces, pnpm workspaces, Turborepo, Nx.

**Decisión**: pnpm workspaces, sin Turborepo/Nx por ahora.

**Razón**:
- pnpm es rápido y eficiente en disco.
- Workspaces nativos alcanzan; Turborepo/Nx son overkill para 2 apps + 1 package.
- Si crece la cantidad de apps/packages, se evalúa Turborepo (es agregar un archivo, no migración).

**Consecuencias**:
- Sin caching de tareas. Builds completos cada vez. Para 2 apps no es problema.

---

## ADR-008 — Routing por subdominio (no por path)

**Contexto**: cada gym/trainer tiene branding propio. Las opciones son `olimpo.rutinex.app` o `rutinex.app/olimpo`.

**Decisión**: subdominio real.

**Razón**:
- Branding fuerte: el alumno ve `olimpo.rutinex.app`, no se le mete Rutinex en la cara.
- Permite custom domains más adelante (`app.gimnasioolimpo.com.ar` apuntando vía CNAME).
- Separación natural en cookies y CORS por subdominio.

**Consecuencias**:
- DNS más complejo (wildcard).
- En dev, hay que usar `*.localhost:3000` (Chrome lo soporta directo; Safari requiere `*.lvh.me` o `*.localtest.me`).
- En prod, costo: Vercel cobra dominios custom en planes pagos. Para wildcard `*.rutinex.app` con un solo Vercel project, está cubierto en plan Pro. Si arrancamos en free tier, evaluamos limitaciones.

---

## ADR-009 — Node 22 LTS, NestJS 11, Next 15, Tailwind 4

Lock de versiones mayores. Se sube major solo con justificación explícita en ADR.

---

(Próximas decisiones se agregan acá con numeración consecutiva.)
