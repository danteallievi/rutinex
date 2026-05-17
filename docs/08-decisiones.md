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

(Próximas decisiones se agregan acá con numeración consecutiva.)
