import {
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
  UpdateResult,
  DeleteResult,
  DeepPartial,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

/**
 * Base para repositorios de tablas con `tenant_id`. Rechaza las queries
 * comunes (`find`, `findOne`, `count`, `update`, `delete`) cuando el `where`
 * no incluye el filtro por tenant — es la defensa principal de ADR-002 contra
 * leaks cross-tenant.
 *
 * Tira `Error` (no `HttpException`) porque llegar acá es un bug de programación:
 * un service intentó leer/escribir sin tenant scope. Queremos que falle ruidoso
 * en tests y dev, no que se traduzca a un 500 silencioso en prod.
 *
 * Por consistencia con la API de TypeORM, todas las verificaciones devuelven
 * un `Promise.reject` (no un throw síncrono) — así un caller que espera una
 * Promise no se rompe distinto según el código del bug.
 *
 * Si una query es legítimamente cross-tenant (lookup global de SUPERADMIN,
 * resolver un user por id en el flow de auth, etc.), usar los métodos
 * `*AcrossTenants` que skipean el chequeo de forma explícita.
 *
 * Ver `docs/03-multi-tenancy.md` → "Filtrado automático en queries".
 */
export class TenantScopedRepository<
  T extends ObjectLiteral,
> extends Repository<T> {
  override find(options?: FindManyOptions<T>): Promise<T[]> {
    if (!hasTenantFilter(options?.where)) return missingTenant('find');
    return super.find(options);
  }

  override findOne(options: FindOneOptions<T>): Promise<T | null> {
    if (!hasTenantFilter(options.where)) return missingTenant('findOne');
    return super.findOne(options);
  }

  override findOneBy(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<T | null> {
    if (!hasTenantFilter(where)) return missingTenant('findOneBy');
    return super.findOneBy(where);
  }

  override findBy(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<T[]> {
    if (!hasTenantFilter(where)) return missingTenant('findBy');
    return super.findBy(where);
  }

  override count(options?: FindManyOptions<T>): Promise<number> {
    if (!hasTenantFilter(options?.where)) return missingTenant('count');
    return super.count(options);
  }

  override countBy(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<number> {
    if (!hasTenantFilter(where)) return missingTenant('countBy');
    return super.countBy(where);
  }

  override update(
    criteria: Parameters<Repository<T>['update']>[0],
    partialEntity: QueryDeepPartialEntity<T>,
  ): Promise<UpdateResult> {
    if (!hasTenantFilter(criteria)) return missingTenant('update');
    return super.update(criteria, partialEntity);
  }

  override delete(
    criteria: Parameters<Repository<T>['delete']>[0],
  ): Promise<DeleteResult> {
    if (!hasTenantFilter(criteria)) return missingTenant('delete');
    return super.delete(criteria);
  }

  /** Escape hatch: `find` sin chequeo de tenant. Usar sólo en SUPERADMIN o lookups globales. */
  findAcrossTenants(options?: FindManyOptions<T>): Promise<T[]> {
    return super.find(options);
  }

  /** Escape hatch: `findOne` sin chequeo de tenant. */
  findOneAcrossTenants(options: FindOneOptions<T>): Promise<T | null> {
    return super.findOne(options);
  }

  /** Escape hatch: `count` sin chequeo de tenant. */
  countAcrossTenants(options?: FindManyOptions<T>): Promise<number> {
    return super.count(options);
  }

  /** Escape hatch: `update` sin chequeo de tenant (típicamente por id global). */
  updateAcrossTenants(
    criteria: Parameters<Repository<T>['update']>[0],
    partialEntity: QueryDeepPartialEntity<T>,
  ): Promise<UpdateResult> {
    return super.update(criteria, partialEntity);
  }

  /** Escape hatch: `delete` sin chequeo de tenant. */
  deleteAcrossTenants(
    criteria: Parameters<Repository<T>['delete']>[0],
  ): Promise<DeleteResult> {
    return super.delete(criteria);
  }

  /** Igual que `save` pero explícito sobre la intención (sin chequeo de tenant — `save` no filtra). */
  saveAcrossTenants<E extends DeepPartial<T>>(entity: E): Promise<T> {
    return super.save<DeepPartial<T>>(entity);
  }
}

function missingTenant<R>(method: string): Promise<R> {
  return Promise.reject(
    new Error(
      `TenantScopedRepository.${method}: query missing tenant_id filter. ` +
        `Use '${method}AcrossTenants' if this is intentionally cross-tenant.`,
    ),
  );
}

/**
 * `true` si `where` (o cualquier rama de un OR) incluye `tenantId` o `tenant_id`.
 * No mira el *valor* (acepta `null`/`undefined` no — sólo presencia de la key
 * con un valor distinto de undefined).
 */
function hasTenantFilter(where: unknown): boolean {
  if (where === null || where === undefined) return false;
  if (Array.isArray(where)) {
    if (where.length === 0) return false;
    // Para OR: todos los brazos deben filtrar por tenant (sino, un brazo
    // sin filtro filtra todo).
    return where.every((branch) => hasTenantFilter(branch));
  }
  if (typeof where !== 'object') return false;
  const obj = where as Record<string, unknown>;
  for (const key of ['tenantId', 'tenant_id']) {
    if (key in obj && obj[key] !== undefined) {
      return true;
    }
  }
  return false;
}
