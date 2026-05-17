# 00 — Auto-documentación

Este repo mantiene su propia documentación como parte del trabajo de desarrollo. No es opcional. Si un cambio en el código no actualiza la doc correspondiente, el cambio está incompleto.

Las reglas de abajo cubren cada tipo de cambio frecuente. Para cada uno: **qué dispara la regla** y **qué actualizar**.

## Procedimiento A — Cambio en una entidad o relación

**Dispara**: agregar/quitar/renombrar una entidad TypeORM; agregar/quitar/cambiar una columna; cambiar una relación (1:1, 1:N, N:N); agregar/cambiar un índice o constraint.

**Acciones**:

1. Actualizar `docs/02-dominio.md`: tabla de entidades, diagrama de relaciones, glosario si aparece un término nuevo.
2. Si cambia el modelo multi-tenant (ej. una tabla nueva que necesita `tenant_id`), actualizar `docs/03-multi-tenancy.md`.
3. Crear migración TypeORM explícita (`pnpm --filter api migration:generate`).
4. Si la decisión de modelado es no trivial, agregar ADR en `docs/08-decisiones.md`.

## Procedimiento B — Nuevo endpoint en el API

**Dispara**: cualquier `@Get/@Post/@Patch/@Put/@Delete` nuevo.

**Acciones**:

1. Si el endpoint sigue las convenciones de `docs/05-api-conventions.md`: nada extra, solo el código.
2. Si rompe una convención por buena razón: actualizar `docs/05-api-conventions.md` con el nuevo patrón y agregar ADR en `docs/08-decisiones.md` explicando por qué.
3. Si el endpoint introduce un flujo nuevo (ej. invitar alumno, cambiar plan), agregar el flujo a la sección correspondiente de `docs/02-dominio.md`.

## Procedimiento C — Cambio en auth, JWT, sesiones, passwords

**Dispara**: cualquier cambio en módulos `auth`, guards, estrategias Passport, manejo de tokens.

**Acciones**:

1. Actualizar `docs/04-auth.md` con el comportamiento nuevo.
2. Si afecta cómo el frontend obtiene/refresca el token, actualizar `docs/06-frontend-conventions.md` sección "auth client".
3. Agregar ADR si cambia el modelo (ej. pasar de access-token-only a refresh tokens, agregar 2FA, etc.).

## Procedimiento D — Cambio en resolución de tenant / subdominios

**Dispara**: middleware de resolución de host, lógica de matching subdominio→tenant, cambios en cómo se inyecta el `tenant_id` en queries.

**Acciones**:

1. Actualizar `docs/03-multi-tenancy.md` completo.
2. Verificar que ninguna entidad nueva quedó sin `tenant_id` (cruzar con `docs/02-dominio.md`).
3. ADR si cambia la estrategia de tenancy (ej. pasar de shared DB a schema-per-tenant).

## Procedimiento E — Decisión arquitectónica

**Dispara**: cualquier elección entre dos o más caminos técnicos con consecuencias no triviales. Ejemplos: librería para X, patrón Y vs Z, ordenar de cierta manera.

**Acciones**:

1. Agregar entrada en `docs/08-decisiones.md` con formato ADR:
   - **ADR-N — Título**
   - **Contexto**: qué problema se está resolviendo.
   - **Opciones consideradas**: las alternativas.
   - **Decisión**: qué se eligió.
   - **Razón**: por qué.
   - **Consecuencias**: qué implica, qué dolería si hay que revertir.
2. Si la decisión cambia el stack, actualizar `README.md` y `CLAUDE.md`.

## Procedimiento F — Avance del roadmap

**Dispara**: completar un paso de `docs/07-roadmap.md`.

**Acciones**:

1. Actualizar `docs/09-progreso.md`: marcar el paso como completo con la fecha y un resumen de 1-3 líneas de qué quedó hecho.
2. Si quedan deudas técnicas o follow-ups del paso, listarlos en la sección "Pendientes" de `09-progreso.md`.
3. Commit `step(N): <descripción>` que incluye tanto el código como la actualización de docs.
4. Responder al usuario con el **formato de cierre de step** (definido en `CLAUDE.md` → "Flujo por paso"): tres secciones breves — resumen, visible en la web, prompt para la próxima sesión. Nada más. Cuando el step que viene tiene superficies independientes, el prompt puede incluir un breakdown de sub-agentes paralelos (ver ADR-015).

## Procedimiento G — Pausa por límite de tokens / fin de sesión

**Dispara**: estás en medio de un paso y se está por cortar la sesión.

**Acciones**:

1. Antes de cualquier otra cosa, actualizar `docs/09-progreso.md` con:
   - Paso en curso (número y nombre).
   - Lista checkbox de subtareas: qué quedó hecho y qué falta.
   - Archivos tocados.
   - Próxima acción concreta para retomar.
2. Commit `wip(step N): <descripción>` aunque el código no compile (en una branch propia, nunca en `main`).
3. Avisarle al humano cuál es el punto exacto donde se retoma.

## Procedimiento H — Cambio en convenciones de código

**Dispara**: querés introducir un patrón nuevo (ej. cómo manejar paginación, cómo nombrar tests, cómo estructurar componentes Next).

**Acciones**:

1. Actualizar la convención correspondiente: `05-api-conventions.md` o `06-frontend-conventions.md`.
2. Si rompe con algo previo, ADR en `docs/08-decisiones.md`.
3. Aplicá el patrón nuevo solo de acá para adelante; no refactorices código viejo en el mismo PR (esa es una tarea aparte).

## Reglas generales

- **Las docs son código**: revisalas con el mismo cuidado.
- **Si una doc miente, el bug es el doc**: arreglala antes que el código si el código es correcto.
- **No hagas docs largas si no hace falta**: una tabla, tres líneas, listo. La doc útil es la que se mantiene.
- **Si dudás entre actualizar una doc existente o crear una nueva, actualizá la existente**. El repo no crece bien si hay 40 archivos en `/docs`.
