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

| Método  | Ruta                              | Caso típico                                       |
|---------|-----------------------------------|---------------------------------------------------|
| GET     | `/routines`                       | Lista paginada.                                   |
| GET     | `/routines/:id`                   | Detalle.                                          |
| POST    | `/routines`                       | Crear.                                            |
| PATCH   | `/routines/:id`                   | Actualización parcial.                            |
| DELETE  | `/routines/:id`                   | Borrado (lógico o duro según el caso).            |
| POST    | `/routines/:id/assignments`       | Sub-recurso: asignar.                             |
| GET     | `/students/:id/sessions/today`    | Recursos derivados, ruta con sentido para el cliente. |

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
  @IsInt() @Min(1) @Max(100) @Type(() => Number)
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
T  // el recurso, sin wrapper
```

Errores: formato estándar de NestJS, el filtro global asegura:
```json
{
  "statusCode": 400,
  "message": "...",
  "error": "Bad Request",
  "timestamp": "2026-05-13T...",
  "path": "/routines"
}
```

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

## Errores

| Caso                                        | Excepción                          |
|---------------------------------------------|------------------------------------|
| Recurso no existe en este tenant            | `NotFoundException`                |
| Recurso existe pero no podés tocarlo        | `ForbiddenException`               |
| Input inválido                              | DTO ya lo maneja → 400 automático  |
| Conflicto (slug tomado, email duplicado)    | `ConflictException`                |
| Sin auth                                    | `UnauthorizedException`            |
| Estado inválido (sesión ya completada, etc.)| `BadRequestException` con código   |

Para errores de negocio con códigos parseables por frontend:

```ts
throw new BadRequestException({
  code: 'SESSION_ALREADY_COMPLETED',
  message: 'La sesión ya fue completada y no se puede modificar.',
});
```

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
