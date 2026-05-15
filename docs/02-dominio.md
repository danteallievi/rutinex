# 02 — Dominio

## Glosario

| Término                  | Definición                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| **Tenant**               | Una unidad comercial: un gimnasio, un personal trainer, una red de gyms.                                 |
| **OWNER**                | Usuario dueño del tenant. Paga la suscripción. Puede haber TRAINERS bajo él.                             |
| **TRAINER**              | Entrenador que opera dentro del tenant. Arma rutinas, da de alta alumnos.                                |
| **STUDENT**              | Alumno final que entrena. Vive bajo un tenant.                                                           |
| **Ejercicio**            | Una unidad de movimiento (ej. "Press de banca"). Tiene título, descripción y media. Pertenece al tenant. |
| **Rutina**               | Conjunto ordenado de ejercicios con series/reps/peso prescritos.                                         |
| **Asignación**           | Vínculo entre una rutina y un alumno, con fecha de vigencia.                                             |
| **Sesión**               | Instancia de ejecución de una rutina asignada por parte de un alumno, en una fecha.                      |
| **Set**                  | Un set concreto que el alumno ejecutó dentro de una sesión, con reps y peso reales.                      |
| **PR (Personal Record)** | Mejor marca de un alumno en un ejercicio dado. Se deriva del histórico de sets.                          |

## Roles y jerarquía

```
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

| Campo           | Tipo             | Notas                                                                                     |
| --------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| `id`            | uuid PK          |                                                                                           |
| `tenant_id`     | uuid FK          | Index. Todo user pertenece a un tenant.                                                   |
| `email`         | varchar          | UNIQUE compuesto con `tenant_id` (mismo email puede existir en distintos tenants).        |
| `password_hash` | varchar          | Argon2.                                                                                   |
| `first_name`    | varchar          |                                                                                           |
| `last_name`     | varchar          |                                                                                           |
| `dni`           | varchar          | Documento. Nullable para OWNER/TRAINER, obligatorio para STUDENT. UNIQUE con `tenant_id`. |
| `role`          | enum             | `OWNER`, `TRAINER`, `STUDENT`. Un user puede tener un solo rol en MVP.                    |
| `trainer_id`    | uuid FK nullable | Solo para STUDENT: a qué trainer pertenece.                                               |
| `is_active`     | boolean          | El "prender/apagar" del entrenador hacia el alumno.                                       |
| `last_login_at` | timestamptz      | Nullable.                                                                                 |
| `created_at`    | timestamptz      |                                                                                           |
| `updated_at`    | timestamptz      |                                                                                           |

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

| Campo              | Tipo          | Notas                                                                          |
| ------------------ | ------------- | ------------------------------------------------------------------------------ |
| `id`               | uuid PK       |                                                                                |
| `tenant_id`        | uuid FK       |                                                                                |
| `assignment_id`    | uuid FK       |                                                                                |
| `student_id`       | uuid FK→users |                                                                                |
| `routine_snapshot` | jsonb         | Snapshot de la rutina al momento de empezar (por si la rutina cambia después). |
| `started_at`       | timestamptz   |                                                                                |
| `completed_at`     | timestamptz   | Nullable mientras está en curso.                                               |

### `sets`

| Campo             | Tipo         | Notas                                     |
| ----------------- | ------------ | ----------------------------------------- |
| `id`              | uuid PK      |                                           |
| `session_id`      | uuid FK      |                                           |
| `routine_item_id` | uuid FK      |                                           |
| `exercise_id`     | uuid FK      | Denormalizado para queries de PR rápidas. |
| `student_id`      | uuid FK      | Denormalizado por la misma razón.         |
| `tenant_id`       | uuid FK      |                                           |
| `set_number`      | int          | 1, 2, 3...                                |
| `reps`            | int          | Reps ejecutadas.                          |
| `weight_kg`       | numeric(6,2) | Nullable (bodyweight).                    |
| `rpe`             | numeric(3,1) | Nullable. Fase 2.                         |
| `created_at`      | timestamptz  |                                           |

### `personal_records`

Derivable de `sets` pero materializado para queries baratas.

| Campo         | Tipo         | Notas                                             |
| ------------- | ------------ | ------------------------------------------------- |
| `id`          | uuid PK      |                                                   |
| `tenant_id`   | uuid FK      |                                                   |
| `student_id`  | uuid FK      |                                                   |
| `exercise_id` | uuid FK      | UNIQUE con `student_id` + `record_type`.          |
| `record_type` | enum         | `max_weight`, `max_reps_at_weight`, `max_volume`. |
| `weight_kg`   | numeric(6,2) |                                                   |
| `reps`        | int          |                                                   |
| `achieved_at` | timestamptz  |                                                   |
| `set_id`      | uuid FK      | Set en el que se logró.                           |

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
sessions >── assignments
sets >── sessions, routine_items, exercises
personal_records >── exercises, sets
```

## Flujos principales

### F1 — Onboarding de tenant + OWNER

1. OWNER se registra desde landing pública (`rutinex.app/signup`): nombre del gym, slug deseado, email, password.
2. API valida que el slug no esté tomado y matchee `^[a-z0-9](-?[a-z0-9])*$`.
3. Se crea `tenant` (status `trial`) + `user` con role `OWNER`.
4. Email de confirmación (fase 2).
5. OWNER puede ya entrar a `<slug>.rutinex.app/admin`.

### F2 — Alta de TRAINER por OWNER

1. OWNER invita un TRAINER desde `<slug>.rutinex.app/admin/team` con email y nombre.
2. API crea `user` con role `TRAINER`, `is_active=true`, password temporal.
3. Se le manda email con link de set-password (fase 2: por ahora se le da la pass al OWNER en respuesta).

### F3 — Alta de STUDENT por TRAINER

1. TRAINER desde su panel ingresa: DNI, nombre, apellido, email.
2. API crea `user` con role `STUDENT`, `trainer_id` = el trainer logueado, `is_active=true`, password generada.
3. Se le da al TRAINER las credenciales para pasarle al alumno (fase 2: invitación por mail/WhatsApp).

### F4 — Creación de rutina y asignación

1. TRAINER crea ejercicios en su catálogo (si no existen).
2. TRAINER crea una `routine` y le agrega `routine_items` ordenados.
3. TRAINER asigna la rutina a uno o más alumnos con `starts_on`, opcional `ends_on`, y `weekday_mask`.

### F5 — Ejecución por STUDENT

1. STUDENT entra a `<slug>.rutinex.app`, login, ve "Hoy" como home.
2. Si hay una asignación vigente cuyo `weekday_mask` matchea hoy, ve la rutina.
3. Toca "Comenzar" → se crea una `session` con snapshot de la rutina.
4. Por cada ejercicio, ve título/descripción/media. Carga reps + peso por set. Se crean filas en `sets`.
5. Al terminar el último ejercicio, marca como completada (`completed_at`).
6. Background (o on-the-fly): si algún set supera el PR previo del alumno en ese ejercicio, se upserta en `personal_records`.

### F6 — Prender/apagar STUDENT

1. TRAINER cambia `is_active` del STUDENT.
2. Si `is_active=false`: el alumno al loguearse recibe 403 con mensaje "Tu cuenta está pausada, contactá a tu entrenador". No se elimina nada.

## Reglas de integridad importantes

- **Toda tabla excepto `tenants` tiene `tenant_id` NOT NULL** (incluso `refresh_tokens`).
- **No cross-tenant references**: ningún FK puede apuntar a una fila de otro tenant. Esto se garantiza vía guards a nivel app, no a nivel DB (sería caro hacerlo con triggers).
- **`exercises`, `routines`, `routine_items` son inmutables una vez referenciados por una sesión**: si una rutina ya tiene sesiones ejecutadas, edits crean una nueva versión o se permiten solo en campos cosméticos. (Por eso `sessions` guarda `routine_snapshot`.)
