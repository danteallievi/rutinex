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

## ADR-010 — Error shape con `code` parseable + filtro global

**Contexto**: el frontend de signup necesita diferenciar `SLUG_TAKEN` vs `SLUG_RESERVED` para mostrar mensajes distintos (uno sugiere probar otro slug; el otro avisa que está reservado por el sistema). Parsear el `message` por prefijo es frágil y mezcla UX con copy. La convención de `docs/05-api-conventions.md` ya mencionaba `code` para errores de negocio, pero no estaba implementado a nivel filtro global.

**Opciones**:

- Default de NestJS sin filtro custom: `{ statusCode, message, error }`. Sin `code`, sin `timestamp`, sin `path`.
- Una librería tipo `nestjs-typed-error` o `http-errors-enhanced`. Más infra que valor para 3-4 códigos.
- Filtro global propio (`apps/api/src/common/filters/http-exception.filter.ts`) que agrega `timestamp` + `path` y propaga el `code` cuando se construyó la excepción con `new HttpException({ code, message })`.

**Decisión**: filtro global propio, registrado vía `APP_FILTER` en `AppModule` (así lo heredan los `TestingModule` de los e2e sin tocar `main.ts`). Los services tiran excepciones de Nest con un objeto que incluye `code` cuando el frontend necesita distinguirlo.

**Razón**:

- Cero deps nuevas.
- El frontend ya tiene `ApiClientError` tipado que expone `body.code` y mapea a UX.
- Compatible con el shape estándar: si una excepción no tiene `code` (validación del DTO, 401, 5xx), el body queda como lo deja Nest + `timestamp` + `path`.

**Consecuencias**:

- Los `code` son contrato entre back y front. Renombrar uno es breaking change. La lista vive en `docs/05-api-conventions.md` (sección "Códigos de error") y se actualiza cuando se agrega uno.
- `message` viene en español desde el API. Si más adelante queremos UI multi-idioma, el frontend traduce por `code` (no por `message`).
- El filtro está registrado a nivel `AppModule`, no global vía `app.useGlobalFilters` en `main.ts`. Esto asegura que el filtro y el `ValidationPipe` también apliquen en tests e2e que importan `AppModule` directo.

---

## ADR-011 — Subdomain routing en Next: rewrite a `/t/:slug` (sin route groups en el URL)

**Contexto**: `docs/06-frontend-conventions.md` (versión original) proponía que el middleware del frontend reescribiera subdominios a route groups (`(marketing)/(admin)/(student)/...`). Cuando se intentó implementar en Step 4.5 se vio que esto no funciona: las route groups del App Router son organizativas y no aparecen en el URL path, por lo que `NextResponse.rewrite(url)` no puede apuntar a `(student)/foo` — ese path no existe.

**Opciones**:

- Mantener route groups + middleware seteando header `x-tenant-slug`. Para que `/` siga sirviendo distinto según el host, hay que duplicar `page.tsx` en cada grupo y resolver colisiones. Frágil y poco descubrible.
- Private folder (`_t`) en el App Router. Las private folders quedan fuera del routing por diseño; tampoco se pueden alcanzar con rewrite.
- Prefijo real en URL: `/t/:slug/...` para tenants, `/admin/...` para admin, `/` para marketing. Las route groups se usan solo como agrupación de layouts dentro de cada prefix.

**Decisión**: prefijo real. El middleware reescribe `<slug>.host/...` → `/t/:slug/...` (y, cuando llegue Step 21, `superadmin.host/...` → `/superadmin/...`; el subdominio `app.rutinex.app` originalmente previsto fue eliminado con el cambio a sales-led — ver ADR-012).

**Razón**:

- Es la única que funciona dentro del modelo del App Router.
- Las URLs públicas siguen siendo limpias porque la reescritura es server-side: el usuario nunca ve `/t/<slug>` en la barra.
- Route groups quedan disponibles para layout-sharing (compartir un `layout.tsx` entre rutas hermanas), simplemente no se usan para mapear hosts a URLs.

**Consecuencias**:

- El layout del tenant vive en `apps/web/app/t/[slug]/layout.tsx` (cuando se cree), no en `(student)/layout.tsx`.
- Si en el futuro queremos un path público `/t` real (improbable), hay colisión: habría que renombrar el prefijo a algo más feo.
- `docs/06-frontend-conventions.md` quedó alineado con esta decisión.

---

## ADR-012 — Onboarding sales-led, no PLG

**Contexto**: el diseño original asumía signup público (PLG): cualquiera entraba a `rutinex.app/signup`, elegía un slug, ponía email y password, y arrancaba un tenant en modo `trial`. La realidad operativa de Rutinex hoy es otra: el vendedor (Dante) cierra ventas cara a cara con gimnasios y PTs locales, cobra fuera del sistema (transferencia / efectivo) y necesita controlar quién entra y con qué slug.

**Opciones**:

- **A. Mantener signup público (PLG)**: landing con form, validación de slug y email en signup, trial automático, billing integrado más adelante. Buena UX para descubrir el producto orgánicamente; necesita anti-abuso (verificación de email, slug reservado por dominio del email, captcha), tiene riesgo de squatting de slugs y de cargar tenants sin venta cerrada.
- **B. Onboarding manual por SUPERADMIN (sales-led)**: no hay form público; los tenants los crea el SUPERADMIN desde un panel después de cerrar venta. La landing es comercial con CTA a WhatsApp. Sin trial automático.
- **C. Híbrido**: signup público pero todos los tenants empiezan inactivos hasta que el SUPERADMIN los aprueba manualmente. Combina lo peor de los dos (form público con anti-abuso + paso manual igual).

**Decisión**: **B — sales-led, manual por SUPERADMIN**.

**Razón**:

- El negocio hoy es local y de boca en boca; la cantidad de tenants es chica y manejable a mano.
- Cobrar antes de dar acceso elimina la deuda y el riesgo de impago.
- Control absoluto sobre el slug (sin colisiones por carrera de signup ni squatting).
- Cero anti-abuso para construir en MVP (sin captcha, sin verificación de email, sin lógica de trial).
- El cliente final no es técnico (gym owners, PTs); el contacto humano por WhatsApp es lo que esperan, no un form de SaaS.

**Consecuencias**:

- Se elimina `POST /auth/signup`. Login y change-password siguen existiendo.
- Se elimina el subdominio `app.rutinex.app` como surface separado: OWNER/TRAINER se loguean desde `<slug>.rutinex.app/login`.
- Aparece el surface `superadmin.rutinex.app` con su login, su panel de tenants y su `SuperadminGuard`.
- La landing pierde el form de signup; se vuelve comercial con CTA a WhatsApp (`NEXT_PUBLIC_CONTACT_WHATSAPP`). La página `/pricing` se mantiene informativa.
- Sin self-service hay menos "anchas de descubrimiento" del producto. Aceptable mientras el canal sea venta directa.
- **Si en el futuro se quiere PLG**: hay que reactivar `/auth/signup`, abrir landing con form, definir validación de slug en signup (regex, reservados, colisión), agregar anti-abuso (captcha o rate limit fuerte), decidir trial period y billing automático. El modelo de datos ya soporta esto (los tenants ya pueden empezar con `is_active=true` desde el día 1).

---

## ADR-013 — SUPERADMIN como flag en `users`, no tabla separada

**Contexto**: con el cambio a sales-led (ADR-012) aparece un rol nuevo, el SUPERADMIN, que vive fuera de cualquier tenant: crea tenants, resetea passwords, edita branding, ve la lista global. Hay dos maneras de modelarlo.

**Opciones**:

- **A. Tabla separada `superadmins`** con su propio login, sus propios refresh tokens (`superadmin_refresh_tokens`), su propia JwtStrategy. Aislación total entre staff y operadores de Rutinex.
- **B. Flag en `users`**: agregar columna `is_superadmin: boolean DEFAULT false` y permitir `tenant_id IS NULL` cuando ese flag está prendido. Mismo endpoint de login, mismo JWT, mismas refresh tokens, con un `SuperadminGuard` que verifica el flag.

**Decisión**: **B — flag en `users`**.

**Razón**:

- Mínima superficie nueva: una columna, un guard, un endpoint extra (`seed:superadmin`). Ningún módulo de auth duplicado.
- Reuso completo del flujo de auth: rate limiting, Argon2, refresh tokens, detección de reuso, change-password forzado. Hacer todo eso por separado es invitar a divergencia.
- El SUPERADMIN es **operador de la plataforma**, conceptualmente "un user más", no un sistema distinto.
- Si el rol crece (más tipos de operadores: soporte, billing, compliance) se puede modelar con más flags o con un campo `role` reescrito a enum extendido; no se justifica una tabla aparte para 1-3 SUPERADMINs.

**Consecuencias**:

- `users.tenant_id` pasa a **nullable** a nivel tabla. Validación en service: solo NULL cuando `is_superadmin=true`.
- Hace falta un **índice parcial único** `CREATE UNIQUE INDEX users_email_global_unique ON users(email) WHERE tenant_id IS NULL` para evitar dos SUPERADMINs con el mismo email (el UNIQUE compuesto `(tenant_id, email)` no aplica porque Postgres trata `NULL != NULL`).
- Queries que **no** filtran por `tenant_id` (joins globales, scripts, agregaciones) verán también filas de SUPERADMIN. Hay que excluirlos explícitamente cuando se busca "users finales". Documentado en `docs/05-api-conventions.md` y `docs/03-multi-tenancy.md`.
- `refresh_tokens.tenant_id` también pasa a nullable (tokens de SUPERADMIN no tienen tenant).
- **No** se usan magic links ni activation tokens para el primer login: la password generada + `must_change_password` cumple ese rol y mantiene el modelo simple (sin tabla `activation_tokens`).
- Si el rol crece (auditoría/compliance separadas, permisos finos), reevaluar tabla aparte y/o RBAC explícito.

---

## ADR-014 — STUDENTS sin password, login por DNI

**Contexto**: los STUDENTS son alumnos finales (clientes del gimnasio o PT). Demográficamente: muchos no son técnicos, varios son adultos mayores, algunos no tienen email propio. Pedirles que recuerden una password generada por el sistema (o que la cambien la primera vez) es fricción real que se ve reflejada en "no me funciona, no puedo entrar" al TRAINER. La app no maneja datos sensibles del alumno: no hay pagos, no hay datos médicos, no hay PII más allá de nombre/apellido/DNI. Lo único que el alumno hace es ver su rutina y registrar reps/peso.

**Opciones**:

- **A. Password generada igual que el staff**: el TRAINER al crear el alumno recibe la password, se la pasa. El alumno cambia password en el primer login (`must_change_password=true`). Consistente con el resto de la auth.
- **B. DNI + factor extra** (fecha de nacimiento, código de 4 dígitos del TRAINER, etc.): un poco más seguro que solo DNI, pero igual de friccional. No hay un factor extra que no sea adivinable o pedible al TRAINER por WhatsApp.
- **C. Solo DNI dentro del subdominio del tenant**: cero passwords para el alumno; el "secreto" es saber el slug del tenant + el DNI del alumno.

**Decisión**: **C — solo DNI dentro del subdominio del tenant**.

**Razón**:

- UX dramáticamente mejor para el público objetivo. "Entrá a `olimpo.rutinex.app` y poné tu DNI" se explica en una frase.
- El daño potencial está acotado: el peor escenario realista es que alguien que conozca el DNI de otro alumno (compañero de gym, ex pareja) entre y modifique series/reps de la rutina. No hay datos sensibles que filtrar ni transacciones que ejecutar.
- Es coherente con cómo operan hoy los gimnasios (acceso por nombre, sin credenciales).
- Si el alcance crece (datos médicos, pagos, mediciones corporales sensibles, mensajería privada con el TRAINER), se revisa este ADR y se agrega password / factor extra para STUDENTS.

**Consecuencias**:

- `users.password_hash` pasa a **nullable** a nivel tabla. Validación en service: NULL solo cuando `role='STUDENT'`.
- `users.must_change_password` no aplica a STUDENTS (siempre `false`).
- `users.dni` pasa a estar **siempre presente para STUDENTS** (validado en service). UNIQUE compuesto con `tenant_id`.
- Endpoint separado `POST /auth/student-login` con `{ dni }` (slug del subdominio). El login de staff (`POST /auth/login`) sigue pidiendo email + password.
- El frontend del tenant tiene dos modos en `/login`: tab "Staff" (email + password) y tab "Soy alumno" (solo DNI).
- Riesgo identificado y aceptado: enumeración de DNIs. Mitigación mínima: rate limiting en `/auth/student-login` por IP + slug. Mensajes genéricos (no decir "DNI no existe" vs "DNI inactivo").
- Si el riesgo crece, opciones futuras: PIN de 4 dígitos seteable por el TRAINER, fecha de nacimiento como segundo factor, magic link al WhatsApp del alumno.

---

## ADR-015 — Paralelización con sub-agentes dentro de un step

**Contexto**: el flujo de `CLAUDE.md` dice "Trabajá un paso a la vez". Esa regla apunta a mantener prolijidad (un commit por step, un mensaje de cierre claro, docs sincronizadas). Pero leída al pie de la letra implica que el thread principal hace todo solo, lo cual frena cuando el step tiene superficies independientes — típicamente backend + frontend, o varios módulos sin archivos compartidos. El interludio visual del Step 4.5 y el visual sprint planeado (Step 7.5) son ejemplos donde múltiples agentes podrían avanzar en paralelo sin pisarse.

**Opciones**:

- **A. Serial estricto**: un solo agente por step, siempre. Garantiza orden pero deja productividad sobre la mesa cuando hay paralelismo natural.
- **B. Paralelismo abierto**: cada sub-agente decide qué hacer y commitea por su cuenta. Maximiza velocidad pero rompe la prolijidad (varios commits por step, docs desincronizadas, conflictos sin árbitro).
- **C. Paralelismo orquestado por el thread principal**: el thread principal escribe el plan, lanza N sub-agentes en paralelo cuando las superficies son independientes, hace merge si hay colisiones, y cierra con un único commit + un único mensaje de cierre.

**Decisión**: **C — paralelismo orquestado**.

**Razón**:

- Mantiene los beneficios de "un paso a la vez": un commit por step, docs sincronizadas, mensaje de cierre limpio.
- Captura la velocidad cuando la estructura del step la permite (frontend + backend, módulos sin archivos compartidos, mockups por surface).
- Centraliza la responsabilidad de prolijidad en el thread principal (que ya tiene contexto del proyecto), no en cada sub-agente.

**Consecuencias**:

- "Un paso a la vez" se reinterpreta como "**un commit por step**", no como "un agente solo".
- El "prompt para la próxima sesión" (formato de cierre) puede opcionalmente incluir un breakdown de sub-agentes paralelos cuando aplique.
- Reglas para el thread principal cuando paraleliza:
  - Solo paralelizar superficies sin archivos compartidos (típicamente: distintos módulos del backend, distintas carpetas del frontend, frontend vs backend).
  - Lanzar todos los sub-agentes en un solo mensaje (un bloque con N Agent calls).
  - Cada sub-agente recibe en su prompt los docs relevantes a leer + las reglas del proyecto + su scope exacto + la prohibición explícita de tocar fuera de su scope o de commitear.
  - Si dos sub-agentes accidentalmente tocan el mismo archivo (típico: `lib/mock-data.ts`, `app/layout.tsx`, `middleware.ts`), el thread principal hace el merge antes de validar.
  - El thread principal corre lint + tests + build y commitea una sola vez al final.
  - Si un sub-agente se traba o tarda, el thread principal lo cancela y cierra el step con lo que esté listo, dejando lo pendiente explícito en `docs/09-progreso.md`.
- **No paralelizar** cuando: el step toca un solo módulo con muchas dependencias internas (típicamente: auth completa, refactors transversales, cambios al `AppModule`/`AuthModule`/`UsersService` que varios steps consecutivos necesitan), o cuando los sub-agentes necesitarían el output de los otros para arrancar (en ese caso, secuencial).

---

## ADR-016 — Sistema de design tokens (3 capas) + stack tipográfico

**Contexto**: hoy `apps/web/app/globals.css` mete todos los colores en `:root` sin separar qué es brand, qué es semántica, qué es shadcn y qué overridea el tenant. El theme es dark fijo (no hay variante light), el `primaryColor` del tenant se inyecta como CSS var ad hoc en `app/t/[slug]/page.tsx`, y los hexa naranjas (`#f97316`) están repetidos hardcodeados en `--brand-primary`, `--primary`, `--ring`, `--sidebar-primary`, `--sidebar-ring` y en cada `--chart-*`. Mientras todo viva en `:root` y sin capas:

- Soportar light/dark implica duplicar 20+ vars en dos `:root`, con riesgo alto de drift.
- Rebrandear (cambiar el naranja por otro color, o el dark por una paleta marrón/sépia) implica buscar y reemplazar valores en N lugares.
- Cuando se quiera permitir que un tenant overridee más que el `primaryColor` (ej. accent secundario, color de fondo del student surface), no hay un punto único donde inyectar esas vars sin pisar el theme global.

El stack tipográfico tiene un drift menor pero del mismo tipo: `--font-geist-sans` y `--font-geist-mono` están hardcoded en `app/layout.tsx` con `next/font/google` y en `@theme inline` como `--font-sans`/`--font-mono`/`--font-heading`. El proyecto se va a alejar de Geist (preferencia del dueño por Montserrat para sans, JetBrains Mono encaja mejor con la estética editorial-precision del Step 7.5 — uppercase mono labels + `tabular-nums` para sets/reps/PRs — que Geist Mono). Hacer ese swap sin un sistema deja los nombres `--font-geist-*` regados por el código.

Este ADR define la arquitectura **antes** de implementar dark/light (Fase 4) para que cuando entre la implementación sea mecánica, y para que un futuro rebranding (cambiar la paleta entera) sea un cambio puntual en una capa.

**Opciones**:

- **A. Mantener el modelo actual** (una capa de vars en `:root`). Para light/dark, duplicar todas las vars bajo `[data-theme="light"]` y mantener las dos copias en paralelo.
- **B. Dos capas — semantic + component** (estilo shadcn defaults). `--primary`, `--background`, etc. resuelven contra valores hardcoded; el theme switch reasigna esas vars. Mejora algo, pero un rebrand sigue obligando a tocar cada definición.
- **C. Tres capas + tenant overlay**. **Capa 1 — Brand tokens** (paleta cruda, valores hex): `--rutinex-orange-50..950`, `--rutinex-neutral-50..950`, etc. **Capa 2 — Semantic tokens** (intención, theme-aware): `--color-bg`, `--color-fg`, `--color-accent`, `--color-danger`, etc., que resuelven a brand tokens y cambian de binding en `[data-theme="light"]` vs `[data-theme="dark"]`. **Capa 3 — Component tokens** (las vars que consume shadcn y nuestro CSS): `--card`, `--popover`, `--primary`, etc., que resuelven a semantic tokens. **Tenant overlay**: el tenant solo overridea un set chico de vars (hoy `--color-accent`, mañana quizá `--color-accent-fg` derivado), inyectadas como inline `style` en el wrapper del prefix `/t/[slug]`, sin tocar el resto.

**Decisión**: **C — tres capas + tenant overlay**.

Misma decisión para fuentes, en escala menor: una sola fuente de verdad nombrada por rol (`--font-sans`, `--font-mono`, `--font-heading`) que resuelve a la implementación cargada en `app/layout.tsx`. Si mañana se cambia Montserrat por otra, se cambia en `layout.tsx` y la definición de la var; nada del resto del código se toca.

Decisión concreta del stack tipográfico inicial:

- **Sans (UI, body, headings)**: **Montserrat** vía `next/font/google`, weights `400/500/600/700/800`. Variable CSS expuesta como `--font-sans` (y `--font-heading` apunta a la misma). Razón: preferencia del dueño + buena cobertura de pesos para la jerarquía editorial del Step 7.5, soporte completo de glifos Latin, license abierta (SIL OFL), hosting first-party via next/font.
- **Monospace (números, labels mono uppercase, código)**: **JetBrains Mono** vía `next/font/google`, weights `400/500/600/700`. Variable CSS expuesta como `--font-mono`. Razón: las dos surfaces (admin y student) usan números tabulares y labels mono uppercase pesadamente; JetBrains Mono está pensado específicamente para ese uso, sus tab/digit metrics son consistentes, y combina visualmente bien con Montserrat.
- **Serif**: no se carga por default. Si en el futuro aparece un acento editorial (titular de marketing en `/`, citas de testimonios), se evalúa en ese momento. Candidatos pre-aprobados: **Fraunces** o **Instrument Serif** (ambos vía `next/font/google`).

**Razón**:

- La separación brand → semantic → component es el patrón estándar de design systems (Tailwind v4, Material 3, Radix Themes). Permite **rebrand** (tocar capa 1) y **theme switch** (tocar capa 2) de forma independiente.
- Las vars semánticas tienen nombres que describen **intención** (`--color-bg`, `--color-fg-muted`), no apariencia (`--gray-900`). Eso evita comentarios del tipo "esto es gris en dark pero queda raro en light".
- El tenant overlay queda acotado por diseño a un set chico de vars (capa 2 / 3 específicas) inyectadas vía `style` inline en un wrapper, no como mutación de `:root`. Eso impide que un tenant rompa la legibilidad del surface eligiendo un `primaryColor` con contraste pésimo: solo afecta lo que decidimos exponer. Si un tenant pasa un color sin la versión "foreground" derivada, calculamos un `--color-accent-fg` en server-side con `wcag-contrast` o similar.
- Diferir el ADR hasta el momento de implementar dark/light obliga a refactorizar el código existente (rebautizar `--brand-primary` → `--color-accent`, mover vars de `:root` a una jerarquía, etc.) **dentro del step de la feature**, mezclando refactor con feature. Codificar la arquitectura **antes** vuelve a la implementación una traducción mecánica del ADR.
- El stack de fuentes deja `Geist`/`Geist Mono` (defaults heredados de `create-next-app` en Step 1) por algo elegido a propósito, alineado con la estética editorial-precision ya consolidada en Step 7.5.

**Consecuencias**:

- Se introduce **`app/styles/tokens.css`** (importado desde `app/globals.css`) con las tres capas explícitas:
  ```css
  /* capa 1 — brand (paleta cruda, estática) */
  :root {
    --rutinex-orange-500: #f97316;
    --rutinex-orange-400: #fb923c;
    /* ... toda la escala */
    --rutinex-neutral-50: #fafafa;
    --rutinex-neutral-950: #0a0a0a;
    /* ... */
  }
  /* capa 2 — semantic (intención, theme-aware) */
  :root,
  [data-theme='dark'] {
    --color-bg: var(--rutinex-neutral-950);
    --color-bg-elevated: var(--rutinex-neutral-900);
    --color-fg: var(--rutinex-neutral-50);
    --color-fg-muted: var(--rutinex-neutral-400);
    --color-border: var(--rutinex-neutral-800);
    --color-accent: var(--rutinex-orange-500);
    --color-accent-fg: var(--rutinex-neutral-950);
    --color-danger: /* ... */;
    /* ... */
  }
  [data-theme='light'] {
    --color-bg: var(--rutinex-neutral-50);
    --color-fg: var(--rutinex-neutral-950);
    /* ... bindings invertidos */
  }
  /* capa 3 — component (alias para shadcn + utilities) */
  :root {
    --background: var(--color-bg);
    --foreground: var(--color-fg);
    --card: var(--color-bg-elevated);
    --primary: var(--color-accent);
    --ring: var(--color-accent);
    /* ... */
  }
  ```
- **Regla**: el código nunca importa de capa 1 directo (`bg-rutinex-orange-500` está prohibido fuera de `tokens.css`). Componentes consumen capa 2 (`bg-[var(--color-accent)]`) o capa 3 vía utilities (`bg-primary`). Tailwind 4 las expone via `@theme inline` mapeando solo capa 2/3.
- **Tenant overlay**: el wrapper `<main>` de `app/t/[slug]/...` setea inline solo `--color-accent` (y derivados como `--color-accent-fg`, `--ring`) desde `tenant.branding`. El resto del theme queda intacto. Si más adelante se quiere overridear más, se amplía la lista de vars overridable en un solo lugar (la función `tenantThemeVars(branding)` en `lib/theme.ts`).
- **Dark/Light**: el toggle setea `[data-theme="light"]` en `<html>`. Default: respetar `prefers-color-scheme`; persistir la preferencia en cookie httpOnly (SameSite=Lax) leída en el server para evitar el flash de tema incorrecto en SSR. Detalle de implementación en el step correspondiente.
- **Fuentes**: `app/layout.tsx` carga Montserrat + JetBrains Mono via `next/font/google` y expone `--font-sans` / `--font-mono` / `--font-heading`. Las antiguas `--font-geist-*` se eliminan. `globals.css` reemplaza referencias en `@theme inline` y `font-family` del `body`.
- **Migración**: el step de implementación (Fase 4) hace el refactor mecánico — rebautizar las vars existentes, partir `globals.css` en `tokens.css` + el resto, ajustar `tailwind.config`-equivalente en `@theme inline`, y cargar las fuentes nuevas. No requiere tocar componentes que ya usan utilities (`bg-card`, `text-foreground`, etc.) — esas siguen funcionando porque la capa 3 conserva los mismos nombres.
- **Rebrand futuro**: cambiar el naranja por (digamos) verde implica reemplazar la escala `--rutinex-orange-*` por `--rutinex-green-*` en `tokens.css` y reasignar `--color-accent` a la nueva escala. Todo lo demás sigue funcionando.
- **Riesgo**: si capa 1 y capa 2 se mezclan por error (alguien define `--color-accent: #f97316` saltándose la paleta), el rebrand vuelve a ser doloroso. Mitigación: el step de implementación deja un comentario claro en `tokens.css` y, opcional, un test de regresión que parsea el CSS y verifica que ningún token de capa 2 resuelve a un hex directo.
- **Riesgo de fuentes**: cargar dos familias completas con varios weights agrega payload. Mitigación: `next/font/google` con `display: 'swap'`, `subsets: ['latin']`, y limitar weights a los efectivamente usados (lista arriba). Si el LCP sufre, evaluar bajar Montserrat a `400/600/700` y cubrir el resto con fallbacks del sistema (ya está en el stack: `system-ui, sans-serif`).

---

## ADR-017 — Refresh token: body + cookie httpOnly (acepta ambos)

**Contexto**: el Step 9 introduce refresh tokens rotativos con detección de reuso (ver `docs/04-auth.md` → "Refresh token"). Hay que decidir cómo viaja el refresh entre el server y los clientes. Las dos opciones canónicas:

- **Cookie httpOnly solamente**: server setea cookie `httpOnly secure SameSite=Lax`. El JS del cliente no la ve; el browser la envía automáticamente. Excelente para mitigar XSS robando el refresh, pero fricción real para clientes no-browser (mobile/PWA con storage propio, scripts CLI, tests E2E que no tienen un cookie jar transparente).
- **Body solamente** (response devuelve `refreshToken`, request lo manda en el body): trivial para mobile y tests; el cliente debe guardarlo en algún lado, lo cual en web significa `localStorage` o memoria, ambos accesibles desde JS y por lo tanto vulnerables a XSS.

Los dos surfaces que importan hoy son web (Step 22) y los E2E que estamos escribiendo en Step 9. Mobile/PWA es post-MVP pero la arquitectura no debe encajonarnos.

**Opciones**:

- **A. Cookie httpOnly únicamente.** Más seguro contra XSS, pero rompe el flujo "supertest sin cookie jar manual" y empuja toda la complejidad a mobile cuando aparezca. El web ya funciona "free" con `credentials: 'include'` en los fetch.
- **B. Body únicamente.** Más simple para tests/mobile, pero deja el web obligado a guardar el refresh en JS (o renunciar a XSS-hardening en el path donde más duele).
- **C. Body + cookie (acepta ambos).** Login/student-login/refresh devuelven `refreshToken` **en el body** y **también** setean cookie `rutinex_refresh` httpOnly. Refresh y logout leen el token **del body como prioridad, con cookie como fallback**. Logout/logout-all/change-password limpian la cookie.

**Decisión**: **C — body + cookie, body prioritario**.

**Razón**:

- El web puede ignorar el `refreshToken` del body y dejar que el browser maneje la cookie sola (XSS-hardening al máximo: el JS nunca toca el refresh). En Step 22 el cliente web va a hacer `fetch('/auth/refresh', { credentials: 'include' })` con body vacío y todo funciona.
- Mobile/PWA y los E2E usan el body sin ceremonia, sin tener que orquestar un cookie jar.
- Los superficies coexisten sin breaking changes: si en el futuro endurecemos a "cookie-only", solo dejamos de incluir `refreshToken` en el body y el web sigue andando; los clientes no-web migran a un mecanismo de storage propio.
- Implementación cuesta poco: un helper (`refresh-cookie.ts`) que sabe leer body/cookie y setear/limpiar la cookie, más `cookie-parser` en `main.ts`. CORS pasa a `credentials: true` para que el web pueda mandar la cookie cross-subdomain.

**Consecuencias**:

- `main.ts` agrega `app.use(cookieParser())` y CORS con `credentials: true`. En prod, `app.set('trust proxy', 1)` para que `req.ip` se persista correcto en `refresh_tokens.ip`.
- Cookie config: `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`. `secure` se prende automáticamente cuando `NODE_ENV === 'production'`. `domain` se controla con `REFRESH_COOKIE_DOMAIN` (típicamente `.rutinex.app` en prod para compartir entre `<slug>.rutinex.app` y `superadmin.rutinex.app`). En dev queda sin domain.
- Logout/logout-all/change-password limpian la cookie. Si llega un logout con bearer válido pero sin refresh ni en body ni en cookie, igual responde 204 (idempotente, no se filtra existencia de tokens).
- El body de login/student-login/refresh sumó dos campos: `refreshToken` (string) y `refreshTokenExpiresAt` (ISO timestamp). El front puede ignorarlos si confía en la cookie.
- **Riesgo CSRF**: con cookies de credenciales no-readable + `SameSite=Lax`, un POST cross-site no lleva la cookie (Lax excluye top-level navigations sólo en GET). El único vector remanente sería un mismo eTLD+1 hostil, que no existe en nuestro modelo (`*.rutinex.app` lo controlamos). Si en el futuro queremos un blindaje extra, sumar un CSRF token rotativo en login (no se justifica para MVP). El refresh nunca incluye datos del cliente, sólo rota — el daño potencial es "alguien me hace renovar el token en mi nombre", que es benigno.
- **Riesgo "doble fuente"**: si un cliente buggy manda body y la cookie tiene un token distinto, el body gana. Documentado y testeado.

---

## ADR-018 — Tenant scoping: `TenantGuard` global + `TenantScopedRepository`

**Contexto**: el Step 10 cablea las dos defensas que el modelo multi-tenant (ADR-002) prometía pero todavía no tenía implementadas: el `TenantGuard` que valida cada request autenticada contra su tenant, y el `TenantScopedRepository` que blinda las queries de DB para que ninguna pueda olvidarse del `tenant_id`. Decidir cómo se manifiestan estas piezas tiene varios sub-puntos.

**Decisiones**:

### 1. `TenantGuard` skip list — tres mecanismos, ortogonales

El guard global skipea tres categorías de rutas:

- **`@Public()`**: rutas sin auth (login, healthcheck, `GET /tenants/by-slug`). Comparte el decorador con `JwtAuthGuard`.
- **Path `/superadmin/*`**: detectado por prefijo de URL en el guard (`req.path === '/superadmin' || req.path.startsWith('/superadmin/')`). El `SuperadminController` ya está protegido por `SuperadminGuard` y opera cross-tenant por diseño.
- **`@SkipTenantGuard()`** (nuevo decorador): rutas autenticadas que no viven en contexto de tenant. Aplicado a nivel controller en `AuthController` (login resuelve tenant por host, refresh/logout/change-password operan sobre el JWT del user).

Razón de tener `@SkipTenantGuard()` separado de `@Public()`: son ortogonales. `@Public()` skipea **ambos** guards globales (Jwt y Tenant); `@SkipTenantGuard()` skipea sólo el Tenant. Es decir: una ruta autenticada (JWT requerido) puede no necesitar `x-tenant-slug`. Reusar `@Public()` para eso obligaría a desproteger esas rutas, lo cual está mal.

Detección de path: el guard chequea `req.path === '/superadmin' || req.path.startsWith('/superadmin/')` (no `path.startsWith('/superadmin')` a secas — eso matchearía `/superadminish`, que no es del surface).

### 2. Códigos de error: `TENANT_MISMATCH` colapsa "slug inexistente" + "slug no matchea"

Cuando un user con JWT del tenant A pasa un `x-tenant-slug` que (a) no existe en DB o (b) existe pero pertenece a otro tenant, el guard devuelve **403 `TENANT_MISMATCH`** en los dos casos. **No** se distingue entre los dos.

Razón: distinguir filtra existencia. Si "inexistente" devolviera 404 y "no matchea" devolviera 403, un atacante con un JWT válido podría enumerar slugs de tenants existentes. El colapso es deliberado, aceptando que la distinción a nivel UX no importa (los dos casos llevan al mismo "tu sesión no corresponde a este tenant — re-loguéate").

Códigos nuevos del Step 10:

- **400 `TENANT_SLUG_REQUIRED`**: falta o está vacío el header `x-tenant-slug` en una ruta tenant-scoped.
- **403 `TENANT_MISMATCH`**: el slug no resuelve a un tenant cuyo `id` matchee `req.user.tenantId`. Cubre "slug inexistente" y "slug pertenece a otro tenant".
- **403 `TENANT_INACTIVE`** (ya existía en login): slug matchea el JWT pero el tenant tiene `is_active=false`. Igual que el login: leakeamos existencia para el caso "el OWNER legítimo entra durante una pausa", aceptable por UX (el OWNER necesita el mensaje claro).

Cross-tenant resource access (OWNER de A pidiendo `GET /routines/:id` donde el id pertenece a B): NO lo cubre el guard — lo cubre el service, que filtra siempre por `req.user.tenantId` y devuelve 404 si no encuentra. El guard sólo defiende contra reusar el JWT contra otro tenant.

### 3. `TenantScopedRepository` extiende `Repository<T>` con escape hatches

El wrapper override los métodos comunes de TypeORM (`find`, `findOne`, `findBy`, `findOneBy`, `count`, `countBy`, `update`, `delete`) y devuelve `Promise.reject(Error)` si el `where`/`criteria` no incluye `tenantId` o `tenant_id` (en al menos un brazo de un OR; todos los brazos en arrays).

- **Tira `Error`, no `HttpException`**: llegar acá es un bug de programación, no un caso de negocio. Queremos que falle ruidoso (stack trace en logs, no transformado a 500 silencioso por el filtro global). El filtro de `HttpException` no toca `Error` plano, así que se propaga como 500.
- **`Promise.reject` en lugar de `throw` síncrono**: por consistencia con la signatura de los métodos de `Repository<T>` (todos devuelven `Promise`). Un caller que hace `await repo.find()` recibe una rejection siempre, no un throw síncrono según el bug.

Escape hatches con sufijo `AcrossTenants` (`findAcrossTenants`, `findOneAcrossTenants`, `countAcrossTenants`, `updateAcrossTenants`, `deleteAcrossTenants`, `saveAcrossTenants`): no chequean tenant. **Uso obligatoriamente explícito** — el nombre largo y sufijo `AcrossTenants` actúa como warning de code review: si veo `findOneAcrossTenants`, sé que el caller eligió a propósito una query cross-tenant. Los casos legítimos hoy son:

- `UsersService.findById(id)` (lookup por el JWT del request — cualquier rol, incluido SUPERADMIN).
- `UsersService.setActive/setPassword/setMustChangePassword(id, ...)` (update por id global; el caller validó autorización antes).
- En el futuro, queries cross-tenant del SUPERADMIN (Step 13) van a usarlos también.

### 4. `RefreshTokenService` y `TenantsService` **no** usan `TenantScopedRepository`

- `tenants` no tiene `tenant_id` (es la tabla raíz). El wrapper no aplica.
- `refresh_tokens` tiene `tenant_id` nullable (NULL para tokens de SUPERADMIN, ver Step 9). Pero todas sus queries son por `token_hash` (UNIQUE global) o por `user_id`. Ninguna filtra por `tenant_id` porque no aporta a la lógica del lookup. Forzar al service a usar escape hatches en cada query sería ceremonia sin valor.
- En resumen: el wrapper es para tablas donde el **caso común** es tenant-scoped. Refresh tokens no califica.

`UsersService` sí: la mayoría de los lookups son `(tenant_id, email)` o `(tenant_id, dni)`. Los que no (SUPERADMIN, lookup por id desde JWT) son explícitamente cross-tenant y usan escape hatches.

**Consecuencias**:

- El `AuthController` lleva `@SkipTenantGuard()` a nivel clase — todas sus rutas son cross-tenant por diseño (login resuelve por host, los demás operan sobre el JWT).
- Para Step 12+ (CRUD users, exercises, routines, etc.), cada nuevo módulo:
  - Sus services usan un `Repository` que extiende `TenantScopedRepository<T>` (patrón estándar: `@Injectable() class XxxRepository extends TenantScopedRepository<X> { constructor(ds: DataSource) { super(X, ds.createEntityManager()); } }`).
  - Sus controllers reciben `@TenantId() tenantId: string` en cada handler tenant-scoped.
  - El `TenantGuard` global ya valida que el slug del header coincida con el JWT antes de que el handler corra.
- Si en el futuro queremos AsyncLocalStorage + TypeORM Subscribers (inyección automática de tenant en queries — opción "fase 2" de `docs/03-multi-tenancy.md`), se puede agregar sin tocar la base actual: el wrapper sigue siendo la red de seguridad estática y el subscriber sería una capa adicional dinámica.
- **Riesgo**: si alguien escribe `repo.query('SELECT * FROM users')` o usa `createQueryBuilder()` directo, el wrapper no protege. Mitigación: code review + la convención de `docs/05-api-conventions.md` ("nunca un service hace `this.repo.find()` sin `where`"). Si el riesgo crece, agregamos un linter custom que detecte query strings con `FROM users` sin `WHERE tenant_id`.

---

## ADR-019 — Roles: `RolesGuard` global + SUPERADMIN bypass

**Contexto**: el Step 11 cablea el control de acceso por rol prometido en `docs/04-auth.md`. El decorador `@Roles(...)` marca handlers/controllers con la lista de roles permitidos del tenant (`OWNER`, `TRAINER`, `STUDENT`). El `RolesGuard` global se encadena después de `JwtAuthGuard` (popula `req.user`) y de `TenantGuard` (valida el slug vs el JWT). Hay dos decisiones de diseño que no son obvias.

**Decisiones**:

### 1. Sin `@Roles` → endpoint abierto a cualquier user autenticado

Si no hay meta `@Roles` ni en el handler ni en la clase, el `RolesGuard` skipea y deja pasar. El endpoint queda accesible a cualquier user autenticado del tenant (el `TenantGuard` ya validó que el slug del header coincide con el JWT).

Razón: el `RolesGuard` no es un gate de auth — eso es el `JwtAuthGuard`. Es un filtro de autorización por rol. Si el caller no escribió `@Roles(...)`, está diciendo explícitamente que cualquier rol del tenant puede entrar. La alternativa (denegar por default) obligaría a escribir `@Roles('OWNER','TRAINER','STUDENT')` en cada endpoint que es genuinamente open-to-all-tenant-users (típico: lectura de datos del propio tenant), agregando ruido sin valor.

Riesgo: olvido. Si alguien diseña un endpoint sensible y se olvida del `@Roles`, queda abierto. Mitigación: code review + convención (los CRUD de Step 12+ siempre llevan `@Roles(...)` explícito, incluso cuando son "todos los roles del tenant").

### 2. SUPERADMIN bypassa `RolesGuard` aunque la meta no lo incluya

Si `req.user.isSuperadmin === true`, el guard devuelve `true` sin chequear roles. El SUPERADMIN no tiene `role` (es `null` en el JWT) y nunca matchearía contra `@Roles('OWNER'|'TRAINER'|'STUDENT')`. Sus rutas reales son `/superadmin/*` con `SuperadminGuard`.

Razón: consistencia con el modelo conceptual del SUPERADMIN ("operador con permisos plenos"). En la práctica, un SUPERADMIN no toca rutas tenant-scoped — el `TenantGuard` (Step 10) lo bloquea antes con 403 `TENANT_MISMATCH` porque su `tenantId` es `null`. El bypass del `RolesGuard` cubre dos casos residuales:

- Rutas marcadas `@SkipTenantGuard()` que llevan `@Roles(...)` (raras hoy; podría pasar mañana). Sin el bypass, un SUPERADMIN no podría operar esa ruta jamás, aunque la idea es que sí pueda.
- Defensa en profundidad: si por un bug futuro un SUPERADMIN llegara al `RolesGuard` en una ruta tenant-scoped, el comportamiento esperado es "operador con permisos plenos pasa", no "operador con permisos plenos es bloqueado por un guard de tenant".

No filtra existencia ni habilita acceso que no esté ya implícito en el flag `isSuperadmin`. El SUPERADMIN sigue sin poder leer datos tenant-scoped porque el `TenantScopedRepository` exige `tenant_id` en todas las queries — los services tenant-scoped no pasan ese filtro cuando el JWT es de SUPERADMIN.

### 3. Códigos de error

- **403 `FORBIDDEN_ROLE`**: el `role` del JWT no está en la lista permitida.

**Consecuencias**:

- Cada CRUD de Step 12+ se escribe con `@Roles(...)` explícito (no se asume "any authenticated"). La regla: si el endpoint tiene un control de acceso por rol, llevar `@Roles(...)`. Si no, comentar en el handler por qué.
- `RolesGuard` se registra como `APP_GUARD` después de `TenantGuard` en `AuthModule.providers`. El orden es: `JwtAuthGuard` → `TenantGuard` → `RolesGuard`. NestJS los ejecuta en el orden en que se registran.
- El guard skipea `@Public()` (consistente con `TenantGuard`). No tiene un mecanismo de skip propio: la ausencia de `@Roles` es el skip.
- La ortogonalidad con `SuperadminGuard` queda preservada: el `SuperadminGuard` se aplica a controllers `/superadmin/*` y exige `isSuperadmin === true`; el `RolesGuard` se aplica a rutas tenant-scoped con `@Roles(...)` y deja pasar al SUPERADMIN. Ningún endpoint legítimo usa los dos a la vez.
- **Riesgo**: si en el futuro queremos un rol "operador de tenant" entre OWNER y SUPERADMIN (ej. un soporte interno con acceso a un solo tenant), el modelo de `@Roles` cubre el caso agregando el nuevo rol al enum. El SUPERADMIN bypass sigue siendo correcto porque "operador con permisos plenos" es ortogonal al rol del tenant.

---

## ADR-020 — CRUD users del tenant: jerarquía, scope de listado, soft delete

**Contexto**: el Step 12 implementa el CRUD de `users` del tenant (alta de TRAINER y STUDENT). Los guards globales (Tenant + Roles) gatean el surface, pero hay varias sub-decisiones que dependen de la combinación request/target y no caben en metadata estática. Hay que clavarlas ahora para que Step 12 sea consistente y los siguientes CRUD (Steps 14, 16, etc.) puedan apoyarse en el mismo lenguaje.

**Decisiones**:

### 1. Jerarquía de alta — OWNER crea TRAINER, TRAINER crea STUDENT, fin

- **OWNER** puede crear **TRAINER** (password generada por el sistema, `must_change_password=true`, devuelta en plano una vez).
- **TRAINER** puede crear **STUDENT** (sin password, login por DNI — ADR-014; `trainer_id` se setea automáticamente al `actor.userId`).
- **OWNER intentando crear STUDENT** → 403 `FORBIDDEN_ROLE_HIERARCHY`. Razón: en MVP el OWNER no opera con alumnos directamente; la simplicidad del flujo (TRAINER es el único origen de STUDENTs) gana sobre la flexibilidad. Si un OWNER quiere armar rutinas también, se da de alta a sí mismo como TRAINER en un user separado (en MVP un user tiene exactamente un `role`).
- **TRAINER intentando crear TRAINER u OWNER** → 403 `FORBIDDEN_ROLE_HIERARCHY`. La meta `@Roles('OWNER','TRAINER')` del controller deja pasar a TRAINER (necesario para que pueda crear STUDENTS), pero la combinación role-del-actor × role-del-body la valida el service.
- **SUPERADMIN/OWNER inicial**: no se crean por `POST /users`. El SUPERADMIN sale del CLI seed (Step 7); el OWNER inicial del tenant sale de `POST /superadmin/tenants` (Step 13).

Las pre-condiciones de DTO (TRAINER requiere email, STUDENT requiere DNI, etc.) están **además** validadas en service para que el código sea defensivo si en el futuro alguien sube el endpoint sin `class-validator`.

### 2. Scope del listado por rol

`GET /users`:

- **OWNER**: ve todos los users del tenant (TRAINERs + STUDENTs + sí mismo + otros OWNERs si los hubiera).
- **TRAINER**: ve sus propios STUDENTs (`trainer_id = actor.userId`) más a sí mismo. **No** ve otros TRAINERs ni el OWNER. Razón: el TRAINER es operador, no manager — no necesita saber quién más opera en el tenant, y aislar la vista reduce ruido en el panel.
- **STUDENT**: bloqueado por `@Roles('OWNER','TRAINER')` antes de llegar al service.

Implementación: el service arma un `where` con dos ramas en OR para el caso TRAINER (`[{ tenantId, trainerId: self }, { tenantId, id: self }]`). El `TenantScopedRepository` lo acepta porque ambas ramas filtran por `tenantId`. Los filtros opcionales (`role`, `isActive`) se aplican a las dos ramas: un TRAINER buscando `role=STUDENT` no se ve a sí mismo (su rol es TRAINER) — eso es consistente con la intención del filtro.

### 3. Update y delete: misma jerarquía + restricciones de blast radius

`PATCH /users/:id`:

- OWNER: puede modificar cualquier user del tenant.
- TRAINER: puede modificar (a) a sí mismo y (b) a sus propios STUDENTs. Cualquier otro target → 403 `FORBIDDEN_ROLE_HIERARCHY`.
- Sólo se editan `firstName`, `lastName`, `isActive` en MVP. Para cambiar email/DNI/role/trainerId, borrar y volver a crear.
- Si el update pasa `isActive` de `true` a `false`, el controller revoca todos los refresh tokens del target (no esperamos al refresh siguiente; el OWNER quiere efecto inmediato).

`DELETE /users/:id`:

- Sólo OWNER (cubierto por `@Roles('OWNER')` a nivel handler — gana sobre el `@Roles('OWNER','TRAINER')` de la clase, como confirma el `RolesGuard` con `Reflector.getAllAndOverride([handler, class])`).
- **No se borra a un OWNER** (incluido sí mismo). Mitigación contra lockout del tenant — si hace falta cambiar el dueño, lo hace el SUPERADMIN en Step 13.
- Soft delete = `isActive=false`. **No** se agrega columna `deleted_at` en MVP: el toggle es suficiente para los casos prácticos (pausar alumno/entrenador) y evita tocar el schema en un paso de CRUD puro. Si más adelante necesitamos un audit log "este user fue borrado el día X", se agrega la columna con migración explícita.
- El controller revoca todos los refresh tokens del target después del soft delete — mismo motivo que en update.

### 4. Reset de password — sólo OWNER → TRAINER

`POST /users/:id/reset-password`:

- Sólo OWNER (handler-level `@Roles('OWNER')`).
- Target debe ser **TRAINER del mismo tenant**:
  - STUDENT → 400 `USER_NO_PASSWORD` (login por DNI, no hay password que resetear).
  - OWNER → 403 `FORBIDDEN_ROLE_HIERARCHY` (el reset de OWNER lo hace el SUPERADMIN en Step 13).
- Genera nueva password (misma política que el alta — ADR-014 + `PasswordService.generate()`), persiste hasheada con `must_change_password=true`, devuelve la plana **una vez**. El controller revoca todos los refresh del target (el OWNER hace reset porque el TRAINER perdió/quiere rotar — las sesiones vivas dejan de ser válidas).

### 5. Códigos de error nuevos

- **403 `FORBIDDEN_ROLE_HIERARCHY`**: emitido por `UsersService` cuando la combinación role-del-actor × role-del-target rompe la jerarquía (puntos 1, 3, 4 de arriba). Separado de `FORBIDDEN_ROLE` (que emite el `RolesGuard` por el meta de `@Roles`) para que el frontend pueda distinguir "no podés tocar este endpoint con tu rol" de "podés tocar el endpoint pero no este target específico".
- **400 `USER_NO_PASSWORD`**: reset-password sobre STUDENT.
- **404 `USER_NOT_FOUND`**: el `id` no existe en el tenant del JWT. Cross-tenant también devuelve 404 — el `findOne({ where: { tenantId, id } })` ya filtra por tenant, así que un OWNER de A pidiendo el id de un user de B ve un 404 limpio (no se filtra existencia, alineado con el patrón de ADR-018).
- **409 `EMAIL_TAKEN` / `DNI_TAKEN`**: ya existían como `code` en el service desde Step 5, pero recién se documentan ahora porque Step 12 los expone públicamente vía `POST /users`.

### 6. Wiring de módulos — `forwardRef` entre `AuthModule` y `UsersModule`

`UsersController` necesita `RefreshTokenService` (revocar sesiones en reset/delete/desactivación) y `UsersService` necesita `PasswordService` (generar + hashear passwords del alta/reset). Ambos viven en `AuthModule`. `AuthModule` ya importa `UsersModule` para `UsersService`. Para resolver la dependencia circular: `forwardRef(() => AuthModule)` en `UsersModule.imports` y `forwardRef(() => UsersModule)` en `AuthModule.imports`. `AuthModule` exporta `RefreshTokenService` además de `PasswordService` y los guards.

Razón de no extraer `PasswordModule` / `RefreshTokenModule`: cero ganancia arquitectónica para MVP. El `forwardRef` resuelve el cycle sin agregar capas. Si en el futuro un tercer módulo necesita `PasswordService` y empieza a haber más cycles, se evalúa extraer; hasta entonces, no.

**Consecuencias**:

- El controller queda muy delgado (orquesta service + refresh-token-service); el service concentra la lógica de jerarquía y los `code`s parseables. Las próximas CRUD (Step 14 exercises, Step 16 routines) pueden replicar el patrón: `@Controller(...)` con `@Roles(...)` clase + handler, service con métodos `*ForActor(...)` que reciben `AuthenticatedUser`.
- El SUPERADMIN no toca `POST /users` ni el resto del CRUD — vive en `/superadmin/*` (Step 13). En `users` el `RolesGuard` lo bypassa (ADR-019) pero el `TenantGuard` lo corta antes con `TENANT_MISMATCH` porque su `tenantId` es `null`. Bien.
- **Riesgo**: la decisión de "OWNER no crea STUDENT" es funcional hoy pero podría rotar si aparece el caso PT individual real (un OWNER que es además su propio entrenador). Mitigación: agregar `trainerId?: string` al `CreateUserDto`, permitir que OWNER cree STUDENT si pasa `trainerId` resoluble dentro del tenant. Sin breaking changes (el campo es opcional).
- **Riesgo**: soft delete por `isActive=false` no preserva un `deleted_at` separado del "pausado por administración". Si el caso "alumno de licencia temporal vs alumno borrado" se vuelve relevante, agregamos columna `deleted_at` + un filtro automático en el repo (otra capa de `TenantScopedRepository`).

---

## ADR-021 — Panel SUPERADMIN: transacción atómica + política de múltiples OWNERs

**Contexto**: el Step 13 expone los endpoints del panel SUPERADMIN sobre `/superadmin/tenants/*`. Hay tres sub-decisiones que no caben en los criterios del roadmap y conviene clavar antes de empezar el frontend (Step 28) para que el contrato del API no rote.

**Decisiones**:

### 1. `POST /superadmin/tenants` corre tenant + OWNER en una sola transacción

`SuperadminTenantsService.create()` envuelve la creación del tenant y la del OWNER inicial en una sola `DataSource.transaction(...)`. Si cualquier paso falla (DTO inválido del owner cuando ya estaba creado el tenant, colisión de slug, error de DB), el rollback completo deja el sistema sin filas huérfanas.

La password en plano se genera y hashea **fuera** de la transacción para no extender el tiempo de lock con la espera del Argon2 (decenas de ms). El plano vive sólo en la variable local del handler + la response — no se persiste ni se loggea (ADR-013 ya lo dejaba dicho para alta de OWNERs/TRAINERs, acá lo confirmamos para esta superficie).

### 2. Política con múltiples OWNERs: default "primero por createdAt", override con `?ownerId`

En MVP cada tenant se crea con exactamente un OWNER vía `POST /superadmin/tenants`, así que `POST /superadmin/tenants/:id/reset-owner-password` puede resolver el OWNER de forma única por default. Pero la tabla `users` permite múltiples OWNERs en el mismo tenant (el constraint compuesto sólo prohíbe `(tenant_id, email)` duplicado), así que el endpoint tiene que tener un comportamiento definido para ese caso.

- Sin `?ownerId`: el endpoint elige **el primero por `createdAt ASC`** (en MVP siempre es el OWNER inicial creado en `POST /superadmin/tenants`).
- Con `?ownerId=<uuid>`: filtra por `(id, tenantId, role='OWNER')` y resetea ese OWNER específico. Si no resuelve → 404 `OWNER_NOT_FOUND`.

Por qué no "resetear todos" o "rechazar si hay varios": el caso operativo real del reset es "el OWNER perdió/quiere rotar su pass" — resetear de a uno es lo natural. Si en algún momento un tenant termina con dos OWNERs (futuro: alta de OWNER secundario desde el panel del tenant) y el SUPERADMIN no sabe a cuál apuntar, el frontend del Step 28 puede listar los OWNERs y mostrar un selector — la query `?ownerId` está pensada para eso.

### 3. Toggle `is_active=false` revoca refresh tokens del tenant (efecto inmediato)

`PATCH /superadmin/tenants/:id` con `isActive: false` (y la fila estaba previamente activa) llama a `RefreshTokenService.revokeAllForTenant(tenantId)` antes de devolver la response. Sin esto, las sesiones vivas de los users del tenant seguirían rotando refresh tokens durante 30 días aunque el login esté bloqueado por `TENANT_INACTIVE`.

El access JWT vivo (≤15min) sigue funcionando — no hay blacklist activa — pero `/auth/refresh` ya rechaza con 401 genérico al validar que el tenant esté activo (Step 9). El "límite" efectivo es esos 15min. Aceptable para MVP: si se necesita corte inmediato (caso de abuso), el SUPERADMIN puede combinarlo con otras acciones (revocar al OWNER también, por ejemplo).

Reactivar el tenant (`isActive: false → true`) **no** restaura los refresh tokens revocados — son inválidos para siempre. Los users tienen que hacer login de cero. Esto es deliberado: si los tokens viejos volvieran a valer después de un período de pausa, alguien que se llevó un refresh durante la ventana pausada podría seguir entrando al reactivar.

### 4. Código de error nuevo

- **404 `OWNER_NOT_FOUND`**: emitido por `SuperadminTenantsService.resetOwnerPassword(...)` cuando el tenant no tiene OWNER o cuando `?ownerId` no resuelve. Separado de `USER_NOT_FOUND` para que el frontend del Step 28 pueda mostrar un mensaje específico ("este tenant quedó sin OWNER — caso anómalo, hablar con DBA"). El 404 `TENANT_NOT_FOUND` se mantiene para "el id del tenant no existe".

### 5. `TenantsService.create()` se elimina del módulo `tenants`

El método `create` que existía en `TenantsService` desde Step 4 se borró: el endpoint `POST /tenants` se movió a `POST /superadmin/tenants` (que vive en el módulo `superadmin` y arma el tenant + OWNER en transacción). El service de `tenants` queda con sólo lecturas (`findBySlug`, `findBySlugIncludingInactive`, `findByIdIncludingInactive`). Borrarlo evita duplicación de lógica de slug validation (que sigue viviendo en `tenants/slug.ts` + en el DTO + en `SuperadminTenantsService.create`).

**Consecuencias**:

- El surface SUPERADMIN queda completamente operativo end-to-end vía API: el operador puede crear tenants + OWNERs, listarlos con filtros, pausar/reactivar, resetear password del OWNER. El frontend del Step 28 traduce todo esto a UX (form + modal de "copiá la password una vez" + tabla con toggle).
- Si en el futuro aparece un caso de "delete real" (borrar el tenant + cascade de todo), se agrega `DELETE /superadmin/tenants/:id`. Hoy `is_active=false` es suficiente; el delete real implica decidir qué hacer con sets/sesiones históricas (auditoría legal, etc.) — diferido.
- El endpoint de reset password de OWNER no acepta SUPERADMINs como target — la fila SUPERADMIN tiene `tenant_id IS NULL` y `role IS NULL`, así que el filtro `(tenantId, role='OWNER')` la excluye naturalmente. Si más adelante hace falta resetear la password de otro SUPERADMIN, va por un endpoint separado (`POST /superadmin/users/:id/reset-password` o similar).
- **Riesgo**: la decisión "primero por createdAt" pierde determinismo si por DBA-fix alguien tocara `createdAt` a mano. Improbable, pero `?ownerId` está como escape hatch determinístico.

---

## ADR-022 — CRUD exercises: catálogo per-tenant, hard delete, lectura para STUDENT, filtros con OR

**Contexto**: el Step 14 expone `POST/GET/PATCH/DELETE /exercises` como primer CRUD que apoya el endpoint sobre `TenantScopedRepository` (después de `users`). El roadmap dejaba abiertas cuatro sub-decisiones que conviene clavar para que los Steps 16 (routines) y siguientes puedan referenciarlas en lugar de re-discutirlas.

**Decisiones**:

### 1. Hard delete (no soft) en MVP

`DELETE /exercises/:id` ejecuta `DELETE FROM exercises WHERE tenant_id=$1 AND id=$2`. Sin `deleted_at`, sin toggle `is_active`. Por qué:

- A diferencia de `users` (donde el soft delete preserva el histórico de quién creó qué + permite reactivación), un ejercicio "borrado" no es operativamente recuperable — si el OWNER quiere volver a tenerlo, lo crea de nuevo.
- `routine_items` no existe todavía (Step 16). Cuando exista, agregará una FK a `exercises.id`; ese momento decide qué hacer con ejercicios referenciados (RESTRICT al borrar + UI que muestre "este ejercicio está usado en N rutinas — moverlas primero" vs. soft delete con un flag de "archivado"). Por ahora el caso no existe y agregar la columna ahora sería diseño para hipotético.
- Si más adelante necesitamos auditar "qué ejercicios existieron y fueron borrados" (poco probable en MVP), se agrega `deleted_at` con migración explícita y el wrapper aplica el filtro automático.

### 2. STUDENT puede leer el catálogo del tenant

`GET /exercises` y `GET /exercises/:id` no llevan `@Roles(...)`. Por ADR-019, eso deja el endpoint abierto a cualquier user autenticado del tenant — incluido STUDENT. Razón: el STUDENT necesita ver la descripción, el video/gif y los muscle groups de cada ejercicio durante la ejecución de su sesión. No tenía sentido mantener un endpoint paralelo `/student/exercises/:id` con la misma forma. El catálogo es por tenant, así que el `TenantGuard` ya garantiza aislamiento — el STUDENT de A no ve nada de B.

Las escrituras (POST/PATCH/DELETE) sí llevan `@Roles('OWNER','TRAINER')`.

### 3. Filtro `muscleGroups` con semántica OR (overlap), no AND

`GET /exercises?muscleGroups=chest,triceps` matchea exercises que tengan **al menos uno** de los grupos pedidos. Implementado con el operador `&&` (array overlap) de Postgres sobre el índice GIN `ix_exercises_muscle_groups`.

Razón: el caso operativo del TRAINER armando una rutina es "mostrame todos los ejercicios que toquen pecho o tríceps" (para elegir). Un filtro AND ("ejercicios que toquen pecho **y** tríceps simultáneamente") es raro y, si aparece, el caller filtra del lado del cliente. El OR cubre 95% de los casos con la API más simple.

Trade-off conocido: si el catálogo crece y los TRAINERS quieren AND, agregamos `?muscleGroupsMode=all|any` con default `any`. Sin breaking change.

### 4. Validación `mediaType`↔`mediaUrl` en el service con `code` parseable

La coherencia (`mediaType=none` ⇒ `mediaUrl=null` y viceversa) se valida en `ExercisesService.create/update` y tira `400 EXERCISE_MEDIA_INCONSISTENT`. No se intentó expresar con `@ValidateIf` en el DTO porque encadenar dos validaciones cruzadas sobre el mismo campo (`mediaUrl` requerido si `mediaType !== 'none'` + `mediaUrl` ausente si `mediaType === 'none'`) en class-validator se vuelve ilegible y el mensaje 400 termina siendo el de los decoradores de cadena (`@IsUrl`, `@IsEmpty`) en vez del semántico.

El URL en sí sí se valida en el DTO (`@IsUrl({ require_protocol: true, protocols: ['http', 'https'] })` + `@MaxLength(1024)`) — eso es validación de formato puro y class-validator es la herramienta adecuada.

### 5. Catálogo per-tenant, no global

Cada tenant tiene su catálogo de exercises (FK `tenant_id NOT NULL`). El doc de dominio menciona "Fase 2: catálogo global compartido" como roadmap; en MVP no hay tabla `global_exercises` ni mecanismo de copy-on-write. Si más adelante queremos un catálogo curado por nosotros, las opciones serían: (a) sembrar exercises en cada tenant al crearlo, (b) tabla separada `global_exercises` + join, (c) `tenant_id` nullable + UNIQUE parcial por tenant. La decisión queda diferida.

### 6. Códigos de error nuevos

- **404 `EXERCISE_NOT_FOUND`**: `findOne`/`update`/`delete` cuando el id no existe en el tenant del JWT. Cross-tenant también devuelve 404 (no se filtra existencia, alineado con ADR-018/ADR-020).
- **400 `EXERCISE_MEDIA_INCONSISTENT`**: combinación inválida entre `mediaType` y `mediaUrl` (ver sección 4).

**Consecuencias**:

- `ExercisesController` queda muy delgado (CRUD puro + `@Roles` en escrituras); el service centraliza la única assertion de negocio (coherencia de media). Patrón replicable para Steps 16/17.
- El uso de `createQueryBuilder` en `list` para `q` (ILIKE) y `muscleGroups` (overlap) **no pasa** por las guardas de `TenantScopedRepository`. La convención (documentada en el comentario del repo) es que el primer `.where(...)` sea siempre el filtro de tenant. Si en el futuro alguien introduce un linter custom para QB, se cubre.
- El `created_by` FK es `RESTRICT`: no se puede borrar (hard) un user que tenga exercises creados. Como los users de tenant tienen soft delete (`isActive=false`) y no hard delete real en MVP, esto no se gatilla. Si en el futuro el SUPERADMIN agrega un hard delete de users, hay que migrar el FK a `SET NULL` + hacer `created_by` nullable.

---

## ADR-023 — Storage de media (R2): presigned PUT directo, bucket público, sin cleanup en MVP

**Contexto**: el Step 15 implementa el storage de gifs/videos/imágenes de exercises sobre Cloudflare R2 (ADR-004). Quedan abiertas varias sub-decisiones que conviene clavar antes de tocar código del frontend (Step 24) y para que los siguientes módulos (`routines`, `comments`) puedan reusar el patrón.

**Decisiones**:

### 1. Upload directo del browser con presigned PUT (no proxy via API)

`POST /media/upload-url` firma una URL contra R2 con `PutObjectCommand` y el cliente sube el binario por PUT directo, sin tocar el API. Razones:

- Egress de R2 es gratis (ADR-004), pero el ancho de banda de subida del API (Railway/Fly) sí cuesta. Proxy via API es N veces el tráfico real (cliente→API→R2).
- El API queda fuera del path crítico para uploads grandes (video 50MB), lo que mantiene el process pool libre.
- El SDK S3-compatible (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`) es estándar y trivialmente reemplazable si en el futuro se cambia el provider.

Trade-off: el API no ve el binario, así que no puede validar contenido (¿es realmente un mp4?). El compromiso es que `POST /media/confirm` hace `HeadObject` contra el blob ya subido y verifica `Content-Type` + `Content-Length` reales antes de persistir el `mediaUrl`. Si la validación falla, borra el blob.

### 2. Acceso público vía dominio público de R2 (no presigned GET por request)

Bucket configurado con acceso público de lectura. El `mediaUrl` que persiste el API en `exercises.media_url` es la URL absoluta del objeto (`{R2_PUBLIC_URL}/{key}`). Razones:

- STUDENT ve videos de cada ejercicio durante la sesión — un presigned GET por cada playback es complejidad innecesaria y rompe el caching del browser/CDN.
- El catálogo de exercises es operativamente público dentro del tenant (cualquier rol autenticado puede leer, ADR-022); ofuscar la URL no agrega seguridad real, sólo fricción.
- Los blobs no contienen información sensible (son demos de ejercicios). Si el día de mañana aparece media privada (foto del alumno, video de evaluación), se introduce un segundo bucket privado + presigned GET para esa entidad — sin tocar el catálogo de exercises.

Trade-off: cualquiera con la URL puede ver el blob. Aceptable: las URLs no se filtran ni se enumeran (key incluye UUID v4), y la entidad la conoce sólo el tenant.

### 3. Path scheme `tenants/<tenantId>/exercises/<uuid>.<ext>`

Cada blob vive bajo el prefijo del tenant que lo creó (UUID, no slug — los slugs pueden cambiar; los UUIDs no). El subprefijo `exercises/` deja espacio para futuros kinds (`routines/`, `comments/`, etc.). El UUID v4 del archivo evita colisiones sin coordinación. La extensión se deriva determinísticamente del `Content-Type` (ver `MEDIA_POLICY`).

El `tenantId` en la key sirve para una segunda defensa (además del `TenantGuard`): `POST /media/confirm` rechaza con `MEDIA_KEY_NOT_OWNED` si la key no empieza con `tenants/<jwt.tenantId>/`. Sin esta defensa, un OWNER de A podría confirmar una key que apunte al blob de B (aunque la persistencia caería igual por el lookup tenant-scoped del exercise — defensa en profundidad).

### 4. Límites de tamaño y mime types por kind

Política fija (Step 15 del roadmap):

| kind  | maxBytes | mime types aceptados                         |
| ----- | -------- | -------------------------------------------- |
| video | 50 MB    | `video/mp4`, `video/webm`, `video/quicktime` |
| gif   | 10 MB    | `image/gif`                                  |
| image | 5 MB     | `image/jpeg`, `image/png`, `image/webp`      |

El `sizeBytes` declarado en `POST /media/upload-url` es fail-fast: si ya supera el límite, no se firma nada. Pero el presigned PUT de R2 no firma `Content-Length`, así que un cliente malicioso podría subir más. El control real está en `POST /media/confirm`: `HeadObject` lee el `Content-Length` real y rechaza con `MEDIA_SIZE_EXCEEDED` (borrando el blob) si supera el límite. Lo mismo con `Content-Type`: el `getSignedUrl` firma el `ContentType` declarado (si el cliente intenta cambiarlo en el PUT, la firma falla), pero el confirm igual revalida el real con un `HeadObject` para defensa en profundidad.

### 5. Endpoint genérico (`POST /media/upload-url` + `POST /media/confirm`), no acoplado a exercises

El roadmap pedía `/media/upload-url` + `/media/confirm` y queda así. Razones:

- Cuando aparezcan rutinas con imagen de portada (Step 16+) o comments con foto adjunta, se reusa el mismo endpoint cambiando el path scheme. El `confirm` hoy sólo asocia a exercise; mañana se discrimina por un campo extra (`{ kind: 'exercise' | 'routine', id }`). Cambio sin breaking.
- El upload no necesita conocer el exercise: el cliente lo sabe en frontend y manda los dos requests por separado. Mantiene los dos casos limpios (upload sin exercise = error recoverable: re-confirmás cuando lo crees; upload con exercise = caso happy).

### 6. Cleanup de orphans: nada en MVP, deuda documentada

Si el cliente sube pero nunca llama `POST /media/confirm` (cerró el browser, error de red, etc.), el blob queda huérfano en R2. En MVP es aceptable:

- Volumen bajo (decenas/cientos de tenants × pocos uploads/día).
- Plan gratuito de R2 incluye 10GB; con esos números el costo de blobs huérfanos es marginal.
- Implementar cleanup ahora (cron periódico o lifecycle rule de R2 sobre un prefijo `pending/`) es complejidad prematura.

Cuando duela (decisión cualitativa: si vemos que el bucket crece desproporcionado al uso útil), las opciones son: (a) lifecycle rule de R2 sobre un prefijo `pending/` con expiración a 24h + el confirm copia/move al path final, (b) cron job en el API que cruza R2 vs `exercises.media_url` y borra los no referenciados. La (a) es más barata operacionalmente; la (b) más explícita.

### 7. Dev/test environment

- **Tests** (unit + E2E): mock del cliente S3 vía `overrideProvider(R2_CLIENT)` en el `TestingModule`. `getSignedUrl` se mockea con `jest.mock('@aws-sdk/s3-request-presigner')`. Nunca se toca R2 real.
- **Dev manual**: el provider lee env (`R2_*`); si están vacías, devuelve `null` y `MediaService` responde `503 MEDIA_NOT_CONFIGURED`. Quien quiera probar uploads end-to-end en dev configura su propio bucket de R2 (bucket separado del de prod). No usamos MinIO ni un docker compose extra: agregar otro servicio para una superficie que ya funciona con mocks era complejidad innecesaria.

### 8. Códigos de error nuevos

- **400 `MEDIA_CONTENT_TYPE_NOT_ALLOWED`** — `contentType` no permitido para el `kind` declarado, o el `HeadObject` del confirm devuelve un mime fuera de la política.
- **400 `MEDIA_SIZE_EXCEEDED`** — `sizeBytes` declarado supera el límite, o el size real del blob (vía HeadObject) lo supera.
- **400 `MEDIA_KEY_NOT_OWNED`** — la `key` enviada al confirm no empieza con `tenants/<jwt.tenantId>/`.
- **400 `MEDIA_OBJECT_NOT_FOUND`** — el confirm hizo `HeadObject` y el objeto no existe en el bucket (el cliente no subió, o subió a otra key).
- **503 `MEDIA_NOT_CONFIGURED`** — faltan env vars `R2_*` y el endpoint no puede operar (típicamente en dev sin credenciales).

**Consecuencias**:

- `MediaController` queda muy delgado (dos endpoints, sólo `@Roles('OWNER','TRAINER')`). Toda la lógica de validación/persistencia vive en `MediaService`.
- `MediaService` depende de `ExercisesService.update` para persistir el `mediaUrl` final, reusando la validación de coherencia `mediaType`↔`mediaUrl` de ADR-022 sin duplicarla. Cuando aparezcan más kinds (routines, comments), `confirm` se va a discriminar por el target y delegar a sus respectivos services.
- El presigned PUT firma sólo el `ContentType` y la `Key`, no el `Content-Length`. El control de size real recae en el confirm; sin él, un malicioso podría llenar el bucket. Aceptable hoy porque sólo OWNER/TRAINER tienen acceso y son partes confiables; cuando se abra al STUDENT (no previsto), revisar.
- La extensión en la key es determinística por mime (`video/mp4 → .mp4`, etc.). Si un browser sube con un mime exótico no contemplado, el upload-url devuelve `MEDIA_CONTENT_TYPE_NOT_ALLOWED` antes de firmar nada.

---

(Próximas decisiones se agregan acá con numeración consecutiva.)
