# 02 — Dominio

## Glosario

| Término                  | Definición                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Tenant**               | Una unidad comercial: un gimnasio, un personal trainer, una red de gyms.                                                        |
| **SUPERADMIN**           | Operador de Rutinex (nosotros). Vive fuera de cualquier tenant. Da de alta tenants y OWNERs, resetea passwords, edita branding. |
| **OWNER**                | Usuario dueño del tenant. Paga la suscripción. Puede haber TRAINERS bajo él.                                                    |
| **TRAINER**              | Entrenador que opera dentro del tenant. Arma rutinas, da de alta alumnos.                                                       |
| **STUDENT**              | Alumno final que entrena. Vive bajo un tenant. Se loguea por DNI, sin password.                                                 |
| **Ejercicio**            | Una unidad de movimiento (ej. "Press de banca"). Tiene título, descripción y media. Pertenece al tenant.                        |
| **Rutina**               | Conjunto ordenado de ejercicios con series/reps/peso prescritos.                                                                |
| **Asignación**           | Vínculo entre una rutina y un alumno, con fecha de vigencia.                                                                    |
| **Sesión**               | Instancia de ejecución de una rutina asignada por parte de un alumno, en una fecha.                                             |
| **Set**                  | Un set concreto que el alumno ejecutó dentro de una sesión, con reps y peso reales.                                             |
| **PR (Personal Record)** | Mejor marca de un alumno en un ejercicio dado. Se deriva del histórico de sets.                                                 |

## Roles y jerarquía

```
SUPERADMIN (User con is_superadmin=true, tenant_id=NULL)
  │  (fuera de cualquier tenant; opera el panel /superadmin)
  ▼
Tenant (olimpo)
  └── User (OWNER, paga la suscripción)
        ├── User (TRAINER)
        │     └── Student (asignados a este trainer)
        │           └── Asignaciones → Rutinas
        └── User (TRAINER)
              └── Student
                    └── ...
```

**Notas**:

- El **SUPERADMIN** vive arriba del árbol y es independiente del modelo multi-tenant. No tiene tenant. Se identifica por el flag `users.is_superadmin = true` (sin tabla separada — ver ADR-013).
- En el MVP, el OWNER puede ser también el TRAINER (caso PT individual). Esto se modela con un solo `User` que tiene ambos roles.
- Un STUDENT pertenece a un TRAINER específico dentro del tenant. Si un tenant tiene 3 trainers, cada alumno está asignado a uno.

## Entidades (resumen)

> Las definiciones TypeORM finales viven en `apps/api/src/**/entities/*.entity.ts`. Esta tabla es la fuente de verdad conceptual.

### `tenants`

| Campo                 | Tipo           | Notas                                                |
| --------------------- | -------------- | ---------------------------------------------------- |
| `id`                  | uuid PK        |                                                      |
| `slug`                | varchar UNIQUE | Subdominio. Ej: `olimpo`. Match con `[a-z0-9-]+`.    |
| `name`                | varchar        | Nombre para mostrar. Ej: "Gimnasio Olimpo".          |
| `branding`            | jsonb          | `{ primaryColor, logoUrl, accentColor }`             |
| `is_active`           | boolean        | Default `true`. Si `false`, todo el tenant no entra. |
| `subscription_status` | enum           | `trial`, `active`, `past_due`, `cancelled`. Fase 2.  |
| `created_at`          | timestamptz    |                                                      |
| `updated_at`          | timestamptz    |                                                      |

### `users`

| Campo                  | Tipo             | Notas                                                                                                                         |
| ---------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `id`                   | uuid PK          |                                                                                                                               |
| `tenant_id`            | uuid FK nullable | Index. NOT NULL para users de tenant; NULL **solo** para `is_superadmin=true`. Validado en service.                           |
| `email`                | varchar nullable | UNIQUE compuesto con `tenant_id` para staff. NULL permitido para STUDENTS. Mismo email puede existir en distintos tenants.    |
| `password_hash`        | varchar nullable | Argon2id. NULL para STUDENTS (login por DNI, ver ADR-014). NOT NULL para OWNER/TRAINER/SUPERADMIN, validado en service.       |
| `must_change_password` | boolean          | Default `false`. Se setea `true` cuando el sistema generó la password (alta de OWNER/TRAINER, reset). No aplica a STUDENTS.   |
| `is_superadmin`        | boolean          | Default `false`. Si `true`, `tenant_id` debe ser NULL y `role` se ignora.                                                     |
| `first_name`           | varchar          |                                                                                                                               |
| `last_name`            | varchar          |                                                                                                                               |
| `dni`                  | varchar(20)      | Documento. NULL permitido a nivel tabla; **requerido** para STUDENTS (validado en service). UNIQUE compuesto con `tenant_id`. |
| `role`                 | enum nullable    | `OWNER`, `TRAINER`, `STUDENT`. NULL para SUPERADMIN. Un user no-superadmin tiene exactamente un rol en MVP.                   |
| `trainer_id`           | uuid FK nullable | Solo para STUDENT: a qué trainer pertenece.                                                                                   |
| `is_active`            | boolean          | El "prender/apagar" del entrenador hacia el alumno (o del OWNER hacia un TRAINER).                                            |
| `last_login_at`        | timestamptz      | Nullable.                                                                                                                     |
| `created_at`           | timestamptz      |                                                                                                                               |
| `updated_at`           | timestamptz      |                                                                                                                               |

**Constraints e índices**:

- `UNIQUE (tenant_id, email)` para staff con email — Postgres permite múltiples filas con `(tenant_id=X, email=NULL)` porque trata `NULL != NULL`, lo cual aplica naturalmente a STUDENTS sin email.
- `UNIQUE (tenant_id, dni)` para students.
- `CREATE UNIQUE INDEX users_email_global_unique ON users(email) WHERE tenant_id IS NULL` — índice parcial único para emails de SUPERADMINs (sin él, el UNIQUE compuesto no aplica porque `tenant_id IS NULL`).
- Si en algún momento aparece DNI sin tenant (no existe hoy), repetir el patrón con un índice parcial.

**Consecuencia importante**: queries que **no** filtran por `tenant_id` (joins globales, scripts, agregaciones) verán también filas con `tenant_id IS NULL` (SUPERADMINs). Excluirlos explícitamente cuando corresponda (`WHERE is_superadmin = false` o `WHERE tenant_id IS NOT NULL`). Las queries que sí filtran por `tenant_id = $X` los excluyen naturalmente.

### `exercises`

| Campo           | Tipo          | Notas                                                                |
| --------------- | ------------- | -------------------------------------------------------------------- |
| `id`            | uuid PK       |                                                                      |
| `tenant_id`     | uuid FK       | Cada tenant tiene su catálogo. (Fase 2: catálogo global compartido.) |
| `title`         | varchar       | Ej: "Press de banca".                                                |
| `description`   | text          | Cómo hacerlo, errores comunes.                                       |
| `media_url`     | varchar       | URL en R2 al video/gif. Nullable.                                    |
| `media_type`    | enum          | `video`, `gif`, `image`, `none`.                                     |
| `muscle_groups` | text[]        | Ej: `['chest', 'triceps']`. Para filtrado.                           |
| `created_by`    | uuid FK→users | Quién lo creó.                                                       |
| `created_at`    | timestamptz   |                                                                      |
| `updated_at`    | timestamptz   |                                                                      |

### `routines`

| Campo         | Tipo          | Notas                        |
| ------------- | ------------- | ---------------------------- |
| `id`          | uuid PK       |                              |
| `tenant_id`   | uuid FK       |                              |
| `name`        | varchar       | Ej: "Tren superior - Lunes". |
| `description` | text          | Nullable.                    |
| `created_by`  | uuid FK→users |                              |
| `created_at`  | timestamptz   |                              |
| `updated_at`  | timestamptz   |                              |

### `routine_items`

Ítem dentro de una rutina. Ordenado.

| Campo               | Tipo    | Notas                                           |
| ------------------- | ------- | ----------------------------------------------- |
| `id`                | uuid PK |                                                 |
| `routine_id`        | uuid FK |                                                 |
| `exercise_id`       | uuid FK |                                                 |
| `position`          | int     | Orden dentro de la rutina.                      |
| `prescribed_sets`   | int     | Cantidad de sets prescritos.                    |
| `prescribed_reps`   | varchar | String porque puede ser "8-10", "AMRAP", "30s". |
| `prescribed_weight` | varchar | Nullable. Ej: "RPE 8", "70kg".                  |
| `rest_seconds`      | int     | Nullable.                                       |
| `notes`             | text    | Nullable. "Pausa 1s abajo", etc.                |

### `assignments`

| Campo          | Tipo          | Notas                                           |
| -------------- | ------------- | ----------------------------------------------- |
| `id`           | uuid PK       |                                                 |
| `tenant_id`    | uuid FK       |                                                 |
| `routine_id`   | uuid FK       |                                                 |
| `student_id`   | uuid FK→users |                                                 |
| `assigned_by`  | uuid FK→users | El trainer que asignó.                          |
| `starts_on`    | date          | Desde cuándo está vigente.                      |
| `ends_on`      | date          | Nullable. Si null, vigente indefinidamente.     |
| `weekday_mask` | int           | Bitmask de días de la semana (bit 0 = Domingo). |
| `created_at`   | timestamptz   |                                                 |

### `sessions`

Una sesión es la ejecución de una rutina asignada en una fecha.

| Campo              | Tipo          | Notas                                                                                              |
| ------------------ | ------------- | -------------------------------------------------------------------------------------------------- |
| `id`               | uuid PK       |                                                                                                    |
| `tenant_id`        | uuid FK       | FK RESTRICT a `tenants`.                                                                           |
| `assignment_id`    | uuid FK       | FK RESTRICT a `assignments`. Borrar un assignment con sesiones tira 409 (ADR-026).                 |
| `routine_id`       | uuid FK       | FK RESTRICT a `routines`. Snapshot inline + FK al routine vivo (trazabilidad). ADR-026.            |
| `student_id`       | uuid FK→users |                                                                                                    |
| `routine_snapshot` | jsonb         | Shape de `RoutineResponse` (Step 16): items inline con `exercise` resuelto. Inmutable post-create. |
| `started_at`       | timestamptz   |                                                                                                    |
| `completed_at`     | timestamptz   | Nullable mientras está en curso. Una vez seteado, la sesión es inmutable.                          |

**Constraints e índices**:

- `UNIQUE (assignment_id) WHERE completed_at IS NULL` — sólo 1 sesión abierta por asignación (`uq_sessions_assignment_open`, ADR-026 §4).

### `sets`

| Campo             | Tipo         | Notas                                                                                                                                        |
| ----------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | uuid PK      |                                                                                                                                              |
| `session_id`      | uuid FK      | FK CASCADE — borrar la sesión borra sus sets.                                                                                                |
| `routine_item_id` | uuid FK      | **Nullable + ON DELETE SET NULL**: el snapshot tiene los datos del item; si el PATCH del routine lo borra, los sets sobreviven (ADR-026 §6). |
| `exercise_id`     | uuid FK      | Denormalizado para queries de PR rápidas. FK RESTRICT.                                                                                       |
| `student_id`      | uuid FK      | Denormalizado por la misma razón. FK RESTRICT.                                                                                               |
| `tenant_id`       | uuid FK      | FK RESTRICT.                                                                                                                                 |
| `set_number`      | int          | 1, 2, 3... Único por `(session_id, routine_item_id, set_number)` — validado en service (ADR-026 §7).                                         |
| `reps`            | int          | Reps ejecutadas. >= 0.                                                                                                                       |
| `weight_kg`       | numeric(6,2) | Nullable (bodyweight). En TypeORM mapea a `string` — convertir a `number` cuando se arme la response.                                        |
| `rpe`             | numeric(3,1) | Nullable. Fase 2.                                                                                                                            |
| `created_at`      | timestamptz  |                                                                                                                                              |

### `personal_records`

Derivable de `sets` pero materializado para queries baratas.

| Campo         | Tipo         | Notas                                                                                                          |
| ------------- | ------------ | -------------------------------------------------------------------------------------------------------------- |
| `id`          | uuid PK      |                                                                                                                |
| `tenant_id`   | uuid FK      | FK RESTRICT a `tenants`.                                                                                       |
| `student_id`  | uuid FK      | FK RESTRICT a `users`.                                                                                         |
| `exercise_id` | uuid FK      | FK RESTRICT a `exercises`.                                                                                     |
| `record_type` | enum         | `max_weight`, `max_reps_at_weight`, `max_volume`.                                                              |
| `weight_kg`   | numeric(6,2) | NOT NULL. Sets con `weight_kg=null` (bodyweight) se **skipean** del cálculo en MVP (ADR-027 §3).               |
| `reps`        | int          |                                                                                                                |
| `achieved_at` | timestamptz  | `now()` al insertar/actualizar el row. Hard-PR: no se actualiza en empate (ADR-027 §3).                        |
| `set_id`      | uuid FK      | Set en el que se logró. FK RESTRICT a `sets` — protege la evidencia del PR (no se puede borrar el set fuente). |

**Constraints e índices**:

- `UNIQUE (tenant_id, student_id, exercise_id, record_type)` (`uq_personal_records_target`, ADR-027 §4) — pivote del UPSERT atómico `ON CONFLICT … DO UPDATE … WHERE EXCLUDED > pr`. Resuelve la concurrencia de POSTs de sets simultáneos sin advisory locks ni REPEATABLE READ.

### `comments`

| Campo         | Tipo        | Notas     |
| ------------- | ----------- | --------- |
| `id`          | uuid PK     |           |
| `tenant_id`   | uuid FK     |           |
| `student_id`  | uuid FK     |           |
| `exercise_id` | uuid FK     | Nullable. |
| `session_id`  | uuid FK     | Nullable. |
| `body`        | text        |           |
| `created_at`  | timestamptz |           |

> Fase 2: agregar `is_read_by_trainer` y endpoint para que el TRAINER los vea.

### `refresh_tokens`

Ver `docs/04-auth.md` para el esquema completo.

## Diagrama de relaciones (alto nivel)

```
tenants ──< users
            │
            ├──< exercises (created_by)
            ├──< routines (created_by)
            ├──< assignments (student_id, assigned_by)
            ├──< sessions (student_id)
            ├──< sets (student_id)
            ├──< personal_records (student_id)
            └──< comments (student_id)

routines ──< routine_items >── exercises
assignments >── routines
sessions >── assignments, routines
sets >── sessions, routine_items (nullable), exercises
personal_records >── exercises, sets
```

## Flujos principales

### F0 — Bootstrap del SUPERADMIN (una vez por entorno)

1. Operador corre `pnpm --filter api seed:superadmin` y tipea email + password por stdin.
2. El script crea un `user` con `is_superadmin=true`, `tenant_id=NULL`, `password_hash` (Argon2) de la password tipeada, `must_change_password=false` (la escribiste vos, ya es tuya), `role=NULL`.
3. Login desde `superadmin.rutinex.app/login` con ese par.

> El modelo es **sales-led, no PLG**: no hay signup público. Los tenants los crea el SUPERADMIN después de cerrar la venta cara a cara y cobrar afuera del sistema. Ver ADR-012.

### F1 — Onboarding sales-led (tenant + OWNER por SUPERADMIN)

1. SUPERADMIN cierra venta con un gimnasio o PT. Cobra fuera del sistema.
2. Desde el panel `superadmin.rutinex.app`, el SUPERADMIN llena: nombre del gym, slug deseado, branding inicial (opcional), email + nombre + apellido del OWNER.
3. API valida que el slug matchee las reglas de `docs/03-multi-tenancy.md` (regex, longitud, no reservado) y que no esté tomado.
4. En **una sola transacción**: crea `tenant` (`is_active=true`) + `user` con `role=OWNER`, password generada por el sistema (16 chars, alfabeto `[a-zA-Z0-9]` sin `0/O/o/1/l/I`) hasheada con Argon2, `must_change_password=true`.
5. La response devuelve la password en plano **una sola vez** (no se loggea, no se guarda).
6. SUPERADMIN pasa la password al OWNER por WhatsApp.
7. OWNER entra a `<slug>.rutinex.app/login` con su email + password generada. Login devuelve `mustChangePassword: true`. Frontend redirige a `/change-password` (modo forzado). OWNER setea una password propia y queda con `must_change_password=false`.
8. A partir de ahí, OWNER usa `<slug>.rutinex.app/admin`.

### F2 — Alta de TRAINER por OWNER

1. OWNER invita un TRAINER desde `<slug>.rutinex.app/admin/team` con email, nombre y apellido.
2. API crea `user` con `role=TRAINER`, `is_active=true`, password generada (misma política que F1), `must_change_password=true`.
3. La response devuelve la password en plano **una sola vez**.
4. OWNER se la pasa al TRAINER por el canal que prefiera (WhatsApp). En el primer login, TRAINER pasa por `/change-password` forzado.

### F3 — Alta de STUDENT por TRAINER (sin password)

1. TRAINER desde su panel ingresa: DNI, nombre, apellido. Email es opcional.
2. API valida que el DNI no esté tomado dentro del tenant.
3. API crea `user` con `role=STUDENT`, `trainer_id` = el trainer logueado, `is_active=true`, `password_hash=NULL`, `must_change_password=false`.
4. No hay credencial que entregar: el STUDENT se loguea con su DNI dentro del subdominio del tenant (ver ADR-014).

### F4 — Creación de rutina y asignación

1. TRAINER crea ejercicios en su catálogo (si no existen).
2. TRAINER crea una `routine` y le agrega `routine_items` ordenados.
3. TRAINER asigna la rutina a uno o más alumnos con `starts_on`, opcional `ends_on`, y `weekday_mask`.

### F5 — Ejecución por STUDENT

1. STUDENT entra a `<slug>.rutinex.app`, login, ve "Hoy" como home.
2. Frontend llama `GET /sessions/today`. Si hay una asignación activa cuyo `weekday_mask` matchea hoy (`Date.getUTCDay()` para el bit), responde con `{ assignmentId, routine: <snapshot live>, openSessionId }`. `null` si no hay nada para hoy.
3. Toca "Comenzar" → `POST /sessions { assignmentId }`. El service valida que el assignment esté `active` (no se requiere matchear weekday — el STUDENT puede ejecutar al día siguiente; ADR-026 §5). 1 sesión abierta por asignación (UNIQUE parcial); si ya hay una, el flow reanuda con el `openSessionId` devuelto en `today`.
4. Por cada ejercicio del snapshot, ve título/descripción/media. Carga reps + peso por set vía `POST /sessions/:id/sets { routineItemId, setNumber, reps, weightKg? }`. El service valida que `routineItemId` esté en el snapshot (no en la tabla viva) y que el `setNumber` sea único por `(session, routine_item)`.
5. Al terminar, `POST /sessions/:id/complete` setea `completed_at`. La sesión queda inmutable (más sets o re-complete → 400 `SESSION_ALREADY_COMPLETED`).
6. Dentro de la misma transacción que el `POST /sessions/:id/sets`, si el set supera el PR previo del alumno en ese ejercicio, se upserta en `personal_records` con `ON CONFLICT … DO UPDATE … WHERE EXCLUDED > pr`. Sets con `weight_kg=null` (bodyweight) se skipean del cálculo (Step 19 / ADR-027).

### F6 — Prender/apagar STUDENT

1. TRAINER cambia `is_active` del STUDENT.
2. Si `is_active=false`: el alumno al loguearse recibe 403 con mensaje "Tu cuenta está pausada, contactá a tu entrenador". No se elimina nada.

## Reglas de integridad importantes

- **Toda tabla excepto `tenants` tiene `tenant_id` NOT NULL** (incluso `refresh_tokens`).
- **No cross-tenant references**: ningún FK puede apuntar a una fila de otro tenant. Esto se garantiza vía guards a nivel app, no a nivel DB (sería caro hacerlo con triggers).
- **Snapshot inmutable, rutina viva mutable** (ADR-026): cuando una `session` se crea, congela `routine_snapshot` con el shape de `RoutineResponse`. La rutina viva puede seguir editándose (PATCH replace-all de items) sin afectar el snapshot. **No** se puede borrar la rutina mientras tenga sesiones (FK RESTRICT `sessions.routine_id` → 409 `ROUTINE_HAS_SESSIONS`) ni borrar la asignación si tiene sesiones (FK RESTRICT `sessions.assignment_id` → 409 `ASSIGNMENT_HAS_SESSIONS`). `routine_items` se borran libremente vía PATCH replace-all — los `sets` apuntan al id original con `ON DELETE SET NULL`, así que sobreviven con el snapshot como fuente de verdad de qué ejercicio fue.
