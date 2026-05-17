# Scripts del API

Scripts de mantenimiento / bootstrap. El código vive en `apps/api/src/scripts/`
y se ejecuta con `ts-node`. Cada script lee `apps/api/.env` (vía `dotenv/config`)
y abre la conexión a la DB que apunte `DATABASE_URL`, así que asegurate de que
Postgres esté corriendo (`pnpm db:up` desde la raíz o `apps/api`) y de tener las
migraciones aplicadas (`pnpm --filter @rutinex/api migration:run`).

## `pnpm --filter @rutinex/api seed:superadmin`

Bootstrappea el primer SUPERADMIN (vos). Crea un `user` con
`is_superadmin=true`, `tenant_id=NULL`, `role=NULL` y
`must_change_password=false` (la password la tipeás vos, ya es tuya). Solo se
usa **una vez** por entorno; en prod corre durante el deploy del Step 29.
Fuente de verdad: `docs/04-auth.md` → "Bootstrap del primer SUPERADMIN" y
ADR-013 (SUPERADMIN como flag en `users`).

### Uso

```bash
pnpm --filter @rutinex/api seed:superadmin
```

El script pregunta interactivamente:

- `Email del SUPERADMIN:` — el email queda lowercased.
- `Password (no se muestra):` — ≥ 12 chars; el echo se oculta si el shell es
  TTY. Argon2id (params de `docs/04-auth.md`) se aplica antes de persistir.

Si stdin no es un TTY (CI / piped), se acepta input plano y la password
**no** se oculta:

```bash
printf 'super@rutinex.app\nuna-password-fuerte-asi\n' \
  | pnpm --filter @rutinex/api seed:superadmin
```

### Errores que vas a ver

| Salida (stderr)                                              | Exit | Causa                                                                                            |
| ------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------ |
| `Ya existe un SUPERADMIN con ese email. No se creó nada.`    | `2`  | Colisión del índice parcial único `users_email_global_unique`. Idempotente: re-correrlo es safe. |
| `Seed falló: Email inválido: "..."`                          | `1`  | El email no matchea `^[^\s@]+@[^\s@]+\.[^\s@]+$`.                                                |
| `Seed falló: La password debe tener al menos 12 caracteres.` | `1`  | Password corta. Subila a ≥ 12 chars y re-corré.                                                  |
| `Seed falló: DATABASE_URL no está definida.`                 | `1`  | Falta `apps/api/.env` o la var. Copiá `apps/api/.env.example`.                                   |

Ningún error filtra la password ingresada (no se loggea ni en el caso 2).
