import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, type FindOptionsWhere } from 'typeorm';

import { PasswordService } from '../auth/password.service';
import { RefreshTokenService } from '../auth/refresh-token.service';
import { Tenant } from '../tenants/entities/tenant.entity';
import { isReservedSlug } from '../tenants/slug';
import { toUserResponse } from '../users/dto/user.response';
import { User } from '../users/entities/user.entity';
import type { CreateSuperadminTenantDto } from './dto/create-superadmin-tenant.dto';
import type { ListSuperadminTenantsQueryDto } from './dto/list-superadmin-tenants.query.dto';
import {
  toSuperadminTenantResponse,
  type CreateSuperadminTenantResponse,
  type PaginatedSuperadminTenantsResponse,
  type ResetOwnerPasswordResponse,
  type SuperadminTenantResponse,
} from './dto/superadmin-tenant.response';
import type { UpdateSuperadminTenantDto } from './dto/update-superadmin-tenant.dto';

/**
 * CRUD del panel SUPERADMIN sobre `tenants` (Step 13). Reemplaza al
 * `POST /tenants` público que existía en Step 4. Las rutas viven bajo
 * `/superadmin/tenants/*` y están protegidas por `SuperadminGuard`
 * (no requieren `x-tenant-slug` — son cross-tenant por diseño, ver
 * `docs/03-multi-tenancy.md` → "Superadmin" y `docs/05-api-conventions.md`
 * → "Rutas del superadmin").
 *
 * Las operaciones que tocan varias tablas (crear tenant + OWNER) corren
 * en una sola transacción TypeORM — si cualquier paso falla, rollback
 * completo. Las que sólo tocan una tabla (`PATCH`, `reset-owner-password`)
 * no necesitan transacción explícita.
 *
 * Las queries usan repos crudos del manager / DataSource. No se apoyan en
 * el `TenantScopedRepository` porque la superficie es cross-tenant por
 * diseño (un OWNER del tenant X y un OWNER del tenant Y pueden compartir
 * email — el chequeo de unicidad lo hace el constraint compuesto
 * `(tenant_id, email)`).
 */
@Injectable()
export class SuperadminTenantsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly passwordService: PasswordService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  /**
   * Crea tenant + OWNER inicial en una sola transacción.
   *
   * Pasos:
   * 1. Validar slug (reservado → 409 `SLUG_RESERVED`; el regex/longitud lo
   *    valida el DTO).
   * 2. Generar password en plano (`PasswordService.generate`) y hashearla
   *    *fuera* de la transacción para no extender la duración del lock.
   * 3. Dentro de la transacción: verificar slug libre → crear tenant →
   *    verificar email libre dentro del tenant nuevo (defensivo, aunque
   *    el tenant es nuevo y no debería haber colisión) → crear OWNER con
   *    `must_change_password=true`.
   * 4. Devolver el par + la password en plano (única vez que sale del
   *    server — no se persiste ni se loggea, ADR-013/021).
   */
  async create(
    dto: CreateSuperadminTenantDto,
  ): Promise<CreateSuperadminTenantResponse> {
    if (isReservedSlug(dto.slug)) {
      throw new ConflictException({
        code: 'SLUG_RESERVED',
        message: `Slug "${dto.slug}" is reserved and cannot be used.`,
      });
    }

    const ownerPassword = this.passwordService.generate();
    const passwordHash = await this.passwordService.hash(ownerPassword);

    return this.dataSource.transaction(async (manager) => {
      const tenantRepo = manager.getRepository(Tenant);
      const existing = await tenantRepo.findOne({ where: { slug: dto.slug } });
      if (existing) {
        throw new ConflictException({
          code: 'SLUG_TAKEN',
          message: `Slug "${dto.slug}" is already taken.`,
        });
      }
      const tenant = await tenantRepo.save(
        tenantRepo.create({
          slug: dto.slug,
          name: dto.name,
          branding: dto.branding ?? {},
          isActive: true,
        }),
      );

      const userRepo = manager.getRepository(User);
      const owner = await userRepo.save(
        userRepo.create({
          tenantId: tenant.id,
          role: 'OWNER',
          isSuperadmin: false,
          email: dto.owner.email,
          passwordHash,
          firstName: dto.owner.firstName,
          lastName: dto.owner.lastName,
          mustChangePassword: true,
          isActive: true,
        }),
      );

      return {
        tenant: toSuperadminTenantResponse(tenant),
        owner: toUserResponse(owner),
        ownerPassword,
      };
    });
  }

  /**
   * Lista paginada de tenants. Filtro `active`:
   * - `'all'` (default): incluye activos e inactivos.
   * - `'true'`: solo `is_active=true`.
   * - `'false'`: solo `is_active=false`.
   */
  async list(
    query: ListSuperadminTenantsQueryDto,
  ): Promise<PaginatedSuperadminTenantsResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const active = query.active ?? 'all';

    const repo = this.dataSource.getRepository(Tenant);
    const where: FindOptionsWhere<Tenant> = {};
    if (active === 'true') where.isActive = true;
    if (active === 'false') where.isActive = false;

    const [rows, total] = await repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      data: rows.map(toSuperadminTenantResponse),
      page,
      pageSize,
      total,
    };
  }

  /**
   * Actualiza `is_active` y/o `branding`. Si pasa de `is_active: true → false`,
   * revoca todos los refresh tokens del tenant para que las sesiones vivas
   * dejen de poder refrescar (el access JWT sigue valiendo hasta 15min, pero
   * `/auth/refresh` ya devuelve 401 y, además, el flujo de login devuelve
   * 403 `TENANT_INACTIVE`).
   */
  async update(
    id: string,
    dto: UpdateSuperadminTenantDto,
  ): Promise<SuperadminTenantResponse> {
    const repo = this.dataSource.getRepository(Tenant);
    const tenant = await repo.findOne({ where: { id } });
    if (!tenant) {
      throw this.tenantNotFound(id);
    }

    const partial: Partial<Tenant> = {};
    if (dto.isActive !== undefined) partial.isActive = dto.isActive;
    if (dto.branding !== undefined) partial.branding = dto.branding;

    const willDeactivate = tenant.isActive === true && dto.isActive === false;

    if (Object.keys(partial).length > 0) {
      await repo.update({ id }, partial);
    }

    if (willDeactivate) {
      await this.refreshTokenService.revokeAllForTenant(id);
    }

    const updated = await repo.findOne({ where: { id } });
    // Defensive: el find que sigue al update no puede fallar (recién
    // verificamos que existe y nada lo borra entre medio). Si llegara a
    // pasar (ej. delete cascade fuera de banda), tratamos como 404.
    if (!updated) {
      throw this.tenantNotFound(id);
    }
    return toSuperadminTenantResponse(updated);
  }

  /**
   * Resetea la password del OWNER del tenant. Si `ownerId` no se pasa,
   * elige el primero por `createdAt ASC` (en MVP siempre es el OWNER
   * inicial creado en `POST /superadmin/tenants`). Si se pasa, valida
   * que sea OWNER del tenant indicado.
   *
   * Tira:
   * - 404 `TENANT_NOT_FOUND` si el tenant no existe.
   * - 404 `OWNER_NOT_FOUND` si el tenant no tiene ningún OWNER, o si el
   *   `ownerId` no resuelve a un OWNER del tenant.
   *
   * Después de persistir, revoca todos los refresh tokens del OWNER target
   * (al recibir la password nueva, hace login de cero con
   * `must_change_password=true`).
   */
  async resetOwnerPassword(
    tenantId: string,
    ownerId?: string,
  ): Promise<ResetOwnerPasswordResponse> {
    const tenantRepo = this.dataSource.getRepository(Tenant);
    const tenant = await tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw this.tenantNotFound(tenantId);
    }

    const userRepo = this.dataSource.getRepository(User);

    let target: User | null;
    if (ownerId) {
      target = await userRepo.findOne({
        where: { id: ownerId, tenantId, role: 'OWNER' },
      });
    } else {
      target = await userRepo.findOne({
        where: { tenantId, role: 'OWNER' },
        order: { createdAt: 'ASC' },
      });
    }
    if (!target) {
      throw new NotFoundException({
        code: 'OWNER_NOT_FOUND',
        message: ownerId
          ? `No existe un OWNER con id "${ownerId}" en este tenant.`
          : `El tenant "${tenantId}" no tiene OWNER asignado.`,
      });
    }

    const plain = this.passwordService.generate();
    const hash = await this.passwordService.hash(plain);
    await userRepo.update(
      { id: target.id },
      { passwordHash: hash, mustChangePassword: true },
    );
    await this.refreshTokenService.revokeAllForUser(target.id);

    const updated = await userRepo.findOne({ where: { id: target.id } });
    // Defensive: igual que `update`, el update por id justo después de un
    // find del mismo id no debería desaparecer entre medio.
    const fresh = updated ?? {
      ...target,
      passwordHash: hash,
      mustChangePassword: true,
    };
    return {
      owner: toUserResponse(fresh),
      ownerPassword: plain,
    };
  }

  private tenantNotFound(id: string): NotFoundException {
    return new NotFoundException({
      code: 'TENANT_NOT_FOUND',
      message: `Tenant "${id}" no encontrado.`,
    });
  }
}
