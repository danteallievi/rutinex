# 05 — Convenciones del API

## Estructura de un módulo

Cada módulo del API vive en `apps/api/src/modules/<nombre>/` con esta estructura:

```
modules/routines/
├── routines.module.ts
├── routines.controller.ts
├── routines.service.ts
├── dto/
│   ├── create-routine.dto.ts
│   ├── update-routine.dto.ts
│   └── routine-response.dto.ts
├── entities/
│   ├── routine.entity.ts
│   └── routine-item.entity.ts
└── routines.service.spec.ts
```

## Naming

- Archivos: `kebab-case.ts`.
- Controllers: en plural (`RoutinesController`), endpoints REST plurales.
- Services: en plural (`RoutinesService`).
- Entities: singular (`Routine`, `RoutineItem`).
- DTOs: sufijo claro (`CreateRoutineDto`, `RoutineResponseDto`).
- Métodos de service: empiezan con verbo (`create`, `findAll`, `findOne`, `update`, `remove`, `assignToStudent`).

## REST conventions

| Método | Ruta                           | Caso típico                                           |
| ------ | ------------------------------ | ----------------------------------------------------- |
| GET    | `/routines`                    | Lista paginada.                                       |
| GET    | `/routines/:id`                | Detalle.                                              |
| POST   | `/routines`                    | Crear.                                                |
| PATCH  | `/routines/:id`                | Actualización parcial.                                |
| DELETE | `/routines/:id`                | Borrado (lógico o duro según el caso).                |
| POST   | `/routines/:id/assignments`    | Sub-recurso: asignar.                                 |
| GET    | `/students/:id/sessions/today` | Recursos derivados, ruta con sentido para el cliente. |

- Plural siempre.
- IDs en URL siempre como UUID.
- Nada de `?action=foo`. Si hace falta un verbo no-CRUD, crear sub-recurso (`POST /sessions/:id/complete` ok, `POST /sessions/:id?action=complete` no).

## Paginación

Cursor-based para listas que crecen (sets, sessions, comments). Offset para listas chicas (users del tenant).

**Cursor**:

```
GET /sessions?limit=20&cursor=<opaque>
→ {
  data: [...],
  nextCursor: "<opaque>" | null
}
```

**Offset**:

```
GET /users?page=1&pageSize=20
→ {
  data: [...],
  page: 1,
  pageSize: 20,
  total: 137
}
```

`limit`/`pageSize`: default 20, máximo 100.

## DTOs y validación

- **Todos** los body inputs pasan por DTO con `class-validator`.
- `whitelist: true` y `forbidNonWhitelisted: true` en el ValidationPipe global → propiedades extras rechazadas.
- `transform: true` para convertir tipos.

Ejemplo:

```ts
export class CreateRoutineDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;
}
```

Para query params:

```ts
export class ListRoutinesQuery {
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;

  @IsString()
  @IsOptional()
  cursor?: string;
}
```

## Response shapes

Todas las responses de listas:

```ts
{ data: T[], nextCursor?: string, page?, pageSize?, total? }
```

Todas las responses de un recurso:

```ts
T; // el recurso, sin wrapper
```

Errores: formato estándar de NestJS, el filtro global (`apps/api/src/common/filters/http-exception.filter.ts`, registrado en `AppModule` vía `APP_FILTER`) asegura:

```json
{
  "statusCode": 400,
  "message": "...",
  "error": "Bad Request",
  "timestamp": "2026-05-13T...",
  "path": "/routines"
}
```

Si la excepción se construyó con un objeto que incluye `code`, el filtro lo propaga al body. Ver "Códigos de error" más abajo.

## Tenant scoping (ver `docs/03-multi-tenancy.md`)

Cada service que toca tablas con `tenant_id` recibe el `tenantId` en cada método. **No** se asume de un contexto global hasta que se implemente AsyncLocalStorage (fase 2).

```ts
async findAll(tenantId: string, query: ListRoutinesQuery) { ... }
```

El controller obtiene `tenantId` vía `@TenantId()`:

```ts
@Get()
findAll(@TenantId() tenantId: string, @Query() query: ListRoutinesQuery) {
  return this.service.findAll(tenantId, query);
}
```

### Rutas del superadmin (`/superadmin/*`)

Las rutas bajo el prefijo `/superadmin/*` son cross-tenant por naturaleza (crean tenants, listan todos, resetean passwords). No siguen el contrato de tenant scoping:

- **No** requieren header `x-tenant-slug`.
- **No** pasan por `TenantGuard`.
- Protegidas por `SuperadminGuard` (verifica `req.user.isSuperadmin === true`).
- Los services correspondientes operan sin `tenantId` o lo reciben como **parámetro de input** del request (ej. "resetear OWNER del tenant X").
- Cuando estos services consultan `users`, deben tener en cuenta que existen filas con `tenant_id IS NULL` (los propios SUPERADMINs). Si un endpoint listael universo de "users finales" (OWNER/TRAINER/STUDENT), debe excluir SUPERADMINs explícitamente con `WHERE is_superadmin = false` o `WHERE tenant_id IS NOT NULL`.

### Queries sin filtro por `tenant_id` (scripts, joins globales)

Cualquier query que no filtre por `tenant_id` (scripts de mantenimiento, agregaciones de SUPERADMIN, joins cross-tenant) verá también las filas de SUPERADMIN (`tenant_id IS NULL`). Si la intención es "users finales", agregar el filtro explícito. Si la intención es "todos incluido SUPERADMIN", documentarlo en el call site.

## Errores

| Caso                                         | Excepción                         |
| -------------------------------------------- | --------------------------------- |
| Recurso no existe en este tenant             | `NotFoundException`               |
| Recurso existe pero no podés tocarlo         | `ForbiddenException`              |
| Input inválido                               | DTO ya lo maneja → 400 automático |
| Conflicto (slug tomado, email duplicado)     | `ConflictException`               |
| Sin auth                                     | `UnauthorizedException`           |
| Estado inválido (sesión ya completada, etc.) | `BadRequestException` con código  |

Para errores de negocio con códigos parseables por frontend:

```ts
throw new BadRequestException({
  code: 'SESSION_ALREADY_COMPLETED',
  message: 'La sesión ya fue completada y no se puede modificar.',
});
```

### Códigos de error

Convención: `code` es un `UPPER_SNAKE_CASE` opcional. Se incluye cuando el frontend necesita distinguir un caso del otro a nivel UX (mostrar mensaje distinto, ofrecer acción distinta). Para errores genéricos (validación del DTO, 401, 5xx) no hace falta `code` y se deja el body como lo arme Nest.

`code` es contrato entre back y front: si lo renombrás, es breaking change para el cliente. Decisión ADR-010.

| Status | code                        | Caso                                                                                                                                                                                       | Módulo  |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| 404    | `TENANT_NOT_FOUND`          | `GET /tenants/by-slug/:slug` no existe o no activo                                                                                                                                         | tenants |
| 409    | `SLUG_RESERVED`             | `POST /superadmin/tenants` con slug en la lista de reservados                                                                                                                              | tenants |
| 409    | `SLUG_TAKEN`                | `POST /superadmin/tenants` con slug ya existente                                                                                                                                           | tenants |
| 401    | `INVALID_CREDENTIALS`       | `POST /auth/login`, `/auth/student-login`, `/auth/refresh` — host inválido, user/tenant inexistente o pausado, password mal, refresh inválido o reusado                                    | auth    |
| 403    | `TENANT_INACTIVE`           | `POST /auth/login` o `POST /auth/student-login` cuando el tenant tiene `is_active=false`                                                                                                   | auth    |
| 403    | `USER_INACTIVE`             | Login OK pero el user tiene `is_active=false`                                                                                                                                              | auth    |
| 403    | `NOT_SUPERADMIN`            | `SuperadminGuard` rechaza request con JWT que no es SUPERADMIN                                                                                                                             | auth    |
| 400    | `CURRENT_PASSWORD_REQUIRED` | `POST /auth/change-password` en modo voluntario sin `currentPassword`                                                                                                                      | auth    |
| 400    | `TENANT_SLUG_REQUIRED`      | `TenantGuard` global: ruta tenant-scoped sin header `x-tenant-slug` (o con header vacío)                                                                                                   | auth    |
| 403    | `TENANT_MISMATCH`           | `TenantGuard` global: slug del header no resuelve a un tenant cuyo `id` matchee `req.user.tenantId`. Colapsa "slug inexistente" + "slug de otro tenant" (no se filtra existencia, ADR-018) | auth    |

> Mantener esta tabla cuando se agreguen códigos nuevos.

## Logging

- `pino` como logger (vía `nestjs-pino`).
- Cada request loggea: método, path, status, latency, `tenantId`, `userId`.
- Nunca loggear: passwords, refresh tokens, JWTs completos.
- Errores 5xx: stack completo. Errores 4xx: solo el mensaje.

## Testing

- Cada `*.service.ts` tiene `*.service.spec.ts` con unit tests (mockeo de repositorios).
- E2E para flujos críticos en `apps/api/test/`:
  - Signup + login + refresh + logout.
  - Cross-tenant isolation (un user de tenant A no puede leer datos de tenant B).
  - Asignar rutina + ejecutar sesión + ver PRs.

## Migraciones

- Generadas a mano con `pnpm --filter api migration:generate -- src/migrations/<name>`.
- Nunca `synchronize: true` ni en dev (queremos que las migraciones reflejen exactamente la realidad).
- Cada migración va en su PR/commit.
- `down` siempre implementado.

## Entities (TypeORM)

- Una entity por archivo, en `entities/`.
- Todas las columnas con tipo explícito (`@Column({ type: 'varchar', length: 100 })`).
- Timestamps con `@CreateDateColumn()` y `@UpdateDateColumn()`.
- UUIDs con `@PrimaryGeneratedColumn('uuid')`.
- Relaciones con `eager: false` por defecto. Hacer `relations: [...]` explícito en el service.
- Soft delete con `@DeleteDateColumn()` solo donde lo necesitemos (probablemente solo en `users` para no perder histórico).
