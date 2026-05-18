import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IsNull, type FindOptionsWhere } from 'typeorm';

import type { AuthenticatedUser } from '../auth/jwt-payload';
import { PasswordService } from '../auth/password.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { ListUsersQueryDto } from './dto/list-users.query.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import {
  toUserResponse,
  type CreateUserResponse,
  type PaginatedUsersResponse,
  type ResetPasswordResponse,
  type UserResponse,
} from './dto/user.response';
import { User, UserRole } from './entities/user.entity';
import { UsersRepository } from './users.repository';

export interface CreateUserInput {
  tenantId: string | null;
  role: UserRole | null;
  isSuperadmin?: boolean;
  email?: string | null;
  passwordHash?: string | null;
  dni?: string | null;
  firstName: string;
  lastName: string;
  trainerId?: string | null;
  mustChangePassword?: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * Busca staff (OWNER/TRAINER) por email dentro de un tenant.
   * Excluye SUPERADMINs (que viven con `tenant_id IS NULL`).
   */
  async findByEmailAndTenant(
    tenantId: string,
    email: string,
  ): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { tenantId, email, isSuperadmin: false },
    });
  }

  /**
   * Busca un SUPERADMIN por email (matchea el índice parcial único
   * `users_email_global_unique`). Devuelve solo filas con
   * `tenant_id IS NULL` y `is_superadmin=true`.
   *
   * Filtra por `tenantId: IsNull()`, lo cual el `TenantScopedRepository`
   * acepta — buscar tokens/users de SUPERADMIN es un caso legítimo y el
   * filtro NULL es explícito.
   */
  async findSuperadminByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email, tenantId: IsNull(), isSuperadmin: true },
    });
  }

  /**
   * Busca un STUDENT por DNI dentro de un tenant.
   */
  async findStudentByDniAndTenant(
    tenantId: string,
    dni: string,
  ): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { tenantId, dni, role: 'STUDENT' },
    });
  }

  /**
   * Busca un user por su id (sin filtrar por tenant). Lo usa `change-password`
   * para resolver el user autenticado por el JWT. Cualquier rol — incluido
   * SUPERADMIN — entra por acá, por eso es un escape-hatch explícito del
   * `TenantScopedRepository`.
   */
  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneAcrossTenants({ where: { id } });
  }

  /**
   * Crea un user respetando las invariantes por rol (ver docs/02-dominio.md
   * y ADR-013 / ADR-014):
   *
   * - SUPERADMIN: `tenant_id=NULL`, `role=NULL`, `password_hash` requerido.
   * - STUDENT: `tenant_id` requerido, `dni` requerido, `password_hash=NULL`.
   * - OWNER/TRAINER: `tenant_id`, `email` y `password_hash` requeridos.
   *
   * Tira `BadRequestException` con `code` parseable cuando se viola una invariante,
   * y `ConflictException` cuando colisiona con un UNIQUE (email por tenant,
   * DNI por tenant, o email global de SUPERADMIN).
   */
  async create(input: CreateUserInput): Promise<User> {
    const isSuperadmin = input.isSuperadmin === true;

    if (isSuperadmin) {
      this.assertValidSuperadmin(input);
      const existing = await this.findSuperadminByEmail(input.email!);
      if (existing) {
        throw new ConflictException({
          code: 'SUPERADMIN_EMAIL_TAKEN',
          message: `Ya existe un SUPERADMIN con el email "${input.email!}".`,
        });
      }
    } else if (input.role === 'STUDENT') {
      this.assertValidStudent(input);
      const existing = await this.findStudentByDniAndTenant(
        input.tenantId!,
        input.dni!,
      );
      if (existing) {
        throw new ConflictException({
          code: 'DNI_TAKEN',
          message: `Ya existe un STUDENT con el DNI "${input.dni!}" en este tenant.`,
        });
      }
    } else if (input.role === 'OWNER' || input.role === 'TRAINER') {
      this.assertValidStaff(input);
      const existing = await this.findByEmailAndTenant(
        input.tenantId!,
        input.email!,
      );
      if (existing) {
        throw new ConflictException({
          code: 'EMAIL_TAKEN',
          message: `Ya existe un usuario con el email "${input.email!}" en este tenant.`,
        });
      }
    } else {
      throw new BadRequestException({
        code: 'USER_INVALID_ROLE',
        message:
          'Un user no-superadmin debe tener role OWNER, TRAINER o STUDENT.',
      });
    }

    const entity = this.usersRepository.create({
      tenantId: isSuperadmin ? null : input.tenantId,
      role: isSuperadmin ? null : input.role,
      isSuperadmin,
      email: input.email ?? null,
      passwordHash:
        input.role === 'STUDENT' ? null : (input.passwordHash ?? null),
      dni: input.dni ?? null,
      firstName: input.firstName,
      lastName: input.lastName,
      trainerId: input.trainerId ?? null,
      mustChangePassword: input.mustChangePassword ?? false,
      isActive: true,
    });
    return this.usersRepository.save(entity);
  }

  /**
   * Prende/apaga al user (toggle del `is_active`). El criteria es por `id` y
   * no incluye `tenant_id` — el caller (típicamente un service interno o el
   * flow de auth) ya verificó que el user le pertenece. Usa el escape hatch
   * `updateAcrossTenants` explícitamente.
   */
  async setActive(id: string, isActive: boolean): Promise<void> {
    const result = await this.usersRepository.updateAcrossTenants(
      { id },
      { isActive },
    );
    if (result.affected === 0) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: `User "${id}" no encontrado.`,
      });
    }
  }

  /**
   * Setea el flag `must_change_password`. Usado por el flujo de password
   * generada (alta o reset) y por el `change-password` forzado al limpiarlo.
   */
  async setMustChangePassword(id: string, value: boolean): Promise<void> {
    const result = await this.usersRepository.updateAcrossTenants(
      { id },
      { mustChangePassword: value },
    );
    if (result.affected === 0) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: `User "${id}" no encontrado.`,
      });
    }
  }

  /**
   * Actualiza `password_hash` y limpia `must_change_password` en la misma
   * sentencia (atomico). Lo usa `POST /auth/change-password` para ambos
   * modos (forzado y voluntario). Va por id (el JWT autenticó al user); usa
   * el escape hatch `updateAcrossTenants`.
   */
  async setPassword(id: string, passwordHash: string): Promise<void> {
    const result = await this.usersRepository.updateAcrossTenants(
      { id },
      { passwordHash, mustChangePassword: false },
    );
    if (result.affected === 0) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: `User "${id}" no encontrado.`,
      });
    }
  }

  // --------------------------------------------------------------------------
  // Step 12 — CRUD: Users del tenant (alta de TRAINER y STUDENT)
  // --------------------------------------------------------------------------
  //
  // Estos métodos asumen que el caller (UsersController) ya pasó por:
  // - JwtAuthGuard (req.user populado)
  // - TenantGuard (tenantId del JWT matchea x-tenant-slug)
  // - RolesGuard con @Roles('OWNER','TRAINER') (o un subset en handlers
  //   específicos como reset/delete que llevan @Roles('OWNER'))
  //
  // La validación de jerarquía OWNER↔TRAINER↔STUDENT que no cabe en los
  // guards (porque depende de la combinación request/target) vive acá y
  // se expresa como 403 `FORBIDDEN_ROLE_HIERARCHY`. Decisión documentada
  // en ADR-020.

  /**
   * Alta de TRAINER (creada por OWNER) o STUDENT (creada por TRAINER).
   *
   * - TRAINER: requiere actor.role=OWNER. Password generada por el sistema,
   *   `must_change_password=true`, devuelta en plano una sola vez.
   * - STUDENT: requiere actor.role=TRAINER. Sin password (login por DNI,
   *   ADR-014). `trainer_id` se setea al `actor.userId` (el TRAINER no
   *   puede asignar al alumno bajo otro TRAINER en MVP).
   *
   * OWNER intentando crear STUDENT o TRAINER creando TRAINER/OWNER →
   * 403 `FORBIDDEN_ROLE_HIERARCHY` (ADR-020).
   */
  async createByActor(
    tenantId: string,
    actor: AuthenticatedUser,
    dto: CreateUserDto,
  ): Promise<CreateUserResponse> {
    if (dto.role === 'TRAINER') {
      if (actor.role !== 'OWNER') {
        throw this.forbiddenHierarchy(
          'Sólo el OWNER puede crear TRAINERS en este tenant.',
        );
      }
      if (!dto.email) {
        throw new BadRequestException({
          code: 'STAFF_EMAIL_REQUIRED',
          message: 'TRAINER requiere email.',
        });
      }
      if (dto.dni) {
        throw new BadRequestException({
          code: 'STAFF_NO_DNI',
          message: 'TRAINER no lleva DNI en MVP.',
        });
      }
      const plain = this.passwordService.generate();
      const passwordHash = await this.passwordService.hash(plain);
      const user = await this.create({
        tenantId,
        role: 'TRAINER',
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        mustChangePassword: true,
      });
      return { user: toUserResponse(user), generatedPassword: plain };
    }

    // dto.role === 'STUDENT'
    if (actor.role !== 'TRAINER') {
      throw this.forbiddenHierarchy(
        'Sólo un TRAINER puede crear STUDENTS bajo su trainer_id.',
      );
    }
    if (!dto.dni) {
      throw new BadRequestException({
        code: 'STUDENT_DNI_REQUIRED',
        message: 'STUDENT requiere DNI.',
      });
    }
    const user = await this.create({
      tenantId,
      role: 'STUDENT',
      dni: dto.dni,
      email: dto.email ?? null,
      firstName: dto.firstName,
      lastName: dto.lastName,
      trainerId: actor.userId,
    });
    return { user: toUserResponse(user) };
  }

  /**
   * Lista paginada de users del tenant, con scope adicional por rol del caller:
   *
   * - OWNER: ve todos los users del tenant (TRAINERs, STUDENTS, y a sí mismo).
   * - TRAINER: ve sus propios STUDENTS (`trainer_id = actor.userId`) más a
   *   sí mismo. No ve otros TRAINERs ni el OWNER (ADR-020).
   *
   * Filtros opcionales: `role`, `isActive`. Paginación offset (page/pageSize).
   */
  async listForActor(
    tenantId: string,
    actor: AuthenticatedUser,
    query: ListUsersQueryDto,
  ): Promise<PaginatedUsersResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const baseFilter: FindOptionsWhere<User> = { tenantId };
    if (query.role !== undefined) baseFilter.role = query.role;
    if (query.isActive !== undefined) baseFilter.isActive = query.isActive;

    let where: FindOptionsWhere<User> | FindOptionsWhere<User>[];
    if (actor.role === 'OWNER') {
      where = baseFilter;
    } else if (actor.role === 'TRAINER') {
      // OR de dos ramas — ambas filtran por tenantId, así que el
      // TenantScopedRepository no rechaza la query. Si el filter `role`
      // está activo, la rama "self" lo aplica igual: un TRAINER buscando
      // `role=STUDENT` no se ve a sí mismo (su rol es TRAINER).
      where = [
        { ...baseFilter, trainerId: actor.userId },
        { ...baseFilter, id: actor.userId },
      ];
    } else {
      // STUDENT no debería llegar (el RolesGuard de la clase corta antes),
      // pero por defensa devolvemos 403.
      throw this.forbiddenHierarchy(
        'Tu rol no puede listar users en este tenant.',
      );
    }

    const [rows, total] = await this.usersRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      data: rows.map(toUserResponse),
      page,
      pageSize,
      total,
    };
  }

  /**
   * Actualiza un user del tenant. Sólo `firstName`, `lastName`, `isActive`.
   *
   * Jerarquía (ADR-020):
   * - OWNER: puede actualizar cualquier user del tenant.
   * - TRAINER: puede actualizar (a) sí mismo, y (b) sus propios STUDENTS
   *   (`trainer_id = actor.userId`). Cualquier otro target → 403
   *   `FORBIDDEN_ROLE_HIERARCHY`.
   *
   * Si se desactiva el user (isActive false → la fila pasa de true a false),
   * el caller (controller) es responsable de revocar refresh tokens —
   * acá sólo persistimos el cambio.
   */
  async updateForActor(
    tenantId: string,
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateUserDto,
  ): Promise<{ response: UserResponse; deactivated: boolean }> {
    const target = await this.usersRepository.findOne({
      where: { tenantId, id },
    });
    if (!target) {
      throw this.userNotFound(id);
    }

    if (actor.role === 'TRAINER') {
      const isSelf = target.id === actor.userId;
      const isOwnStudent =
        target.role === 'STUDENT' && target.trainerId === actor.userId;
      if (!isSelf && !isOwnStudent) {
        throw this.forbiddenHierarchy(
          'Un TRAINER sólo puede modificar a sí mismo o a sus propios STUDENTS.',
        );
      }
    }

    const partial: Partial<User> = {};
    if (dto.firstName !== undefined) partial.firstName = dto.firstName;
    if (dto.lastName !== undefined) partial.lastName = dto.lastName;
    if (dto.isActive !== undefined) partial.isActive = dto.isActive;

    const deactivated = dto.isActive === false && target.isActive === true;

    if (Object.keys(partial).length > 0) {
      await this.usersRepository.update({ tenantId, id }, partial);
    }

    return {
      response: toUserResponse({ ...target, ...partial }),
      deactivated,
    };
  }

  /**
   * Soft delete: setea `isActive=false` sobre un TRAINER o STUDENT del tenant.
   *
   * Restricciones (ADR-020):
   * - Sólo OWNER (cubierto por `@Roles('OWNER')` en el controller).
   * - No se puede borrar otro OWNER (incluido sí mismo). Mitigación contra
   *   lockout del tenant.
   *
   * Idempotente: si el target ya estaba inactivo, igual devuelve éxito. El
   * caller (controller) revoca refresh tokens después de este método.
   */
  async removeForActor(
    tenantId: string,
    actor: AuthenticatedUser,
    id: string,
  ): Promise<void> {
    const target = await this.usersRepository.findOne({
      where: { tenantId, id },
    });
    if (!target) {
      throw this.userNotFound(id);
    }
    if (target.role === 'OWNER') {
      throw this.forbiddenHierarchy(
        'No se puede borrar un OWNER. Pedile al SUPERADMIN si necesitás cambiar el dueño del tenant.',
      );
    }
    if (target.id === actor.userId) {
      // Por consistencia: aunque el target.role no sea OWNER (no debería
      // entrar acá un OWNER por la rama de arriba), prevenimos self-delete.
      throw this.forbiddenHierarchy(
        'No podés borrarte a vos mismo. Pedile a otro OWNER o al SUPERADMIN.',
      );
    }
    await this.usersRepository.update({ tenantId, id }, { isActive: false });
  }

  /**
   * Genera una password nueva para un TRAINER del mismo tenant, la persiste
   * hasheada con `must_change_password=true` y devuelve la plana **una vez**.
   *
   * Reglas (ADR-020 + criterios del Step 12):
   * - Sólo OWNER (cubierto por `@Roles('OWNER')` en el controller).
   * - Target debe ser TRAINER del mismo tenant. Si es STUDENT → 400
   *   `USER_NO_PASSWORD` (los STUDENTS no tienen password — ADR-014).
   *   Si es OWNER → 403 `FORBIDDEN_ROLE_HIERARCHY` (el reset de OWNERs
   *   lo maneja el SUPERADMIN en Step 13).
   *
   * Después de persistir, el caller (controller) revoca todos los refresh
   * tokens del target.
   */
  async resetTrainerPassword(
    tenantId: string,
    id: string,
  ): Promise<ResetPasswordResponse> {
    const target = await this.usersRepository.findOne({
      where: { tenantId, id },
    });
    if (!target) {
      throw this.userNotFound(id);
    }
    if (target.role === 'STUDENT') {
      throw new BadRequestException({
        code: 'USER_NO_PASSWORD',
        message: 'Los STUDENTS no tienen password (login por DNI).',
      });
    }
    if (target.role !== 'TRAINER') {
      throw this.forbiddenHierarchy(
        'Sólo se puede resetear la password de un TRAINER desde acá. Para el OWNER, usar el panel del SUPERADMIN.',
      );
    }

    const plain = this.passwordService.generate();
    const passwordHash = await this.passwordService.hash(plain);
    await this.usersRepository.update(
      { tenantId, id },
      { passwordHash, mustChangePassword: true },
    );

    return { generatedPassword: plain };
  }

  private forbiddenHierarchy(message: string): ForbiddenException {
    return new ForbiddenException({
      code: 'FORBIDDEN_ROLE_HIERARCHY',
      message,
    });
  }

  private userNotFound(id: string): NotFoundException {
    return new NotFoundException({
      code: 'USER_NOT_FOUND',
      message: `User "${id}" no encontrado.`,
    });
  }

  private assertValidSuperadmin(input: CreateUserInput): void {
    if (input.tenantId !== null && input.tenantId !== undefined) {
      throw new BadRequestException({
        code: 'SUPERADMIN_MUST_HAVE_NO_TENANT',
        message: 'Un SUPERADMIN no puede pertenecer a un tenant.',
      });
    }
    if (input.role !== null && input.role !== undefined) {
      throw new BadRequestException({
        code: 'SUPERADMIN_MUST_HAVE_NO_ROLE',
        message: 'Un SUPERADMIN no puede tener role de tenant.',
      });
    }
    if (!input.email) {
      throw new BadRequestException({
        code: 'SUPERADMIN_EMAIL_REQUIRED',
        message: 'El SUPERADMIN requiere email.',
      });
    }
    if (!input.passwordHash) {
      throw new BadRequestException({
        code: 'SUPERADMIN_PASSWORD_REQUIRED',
        message: 'El SUPERADMIN requiere password_hash.',
      });
    }
    if (input.dni) {
      throw new BadRequestException({
        code: 'SUPERADMIN_NO_DNI',
        message: 'Un SUPERADMIN no lleva DNI.',
      });
    }
    if (input.trainerId) {
      throw new BadRequestException({
        code: 'SUPERADMIN_NO_TRAINER',
        message: 'Un SUPERADMIN no puede tener trainer.',
      });
    }
  }

  private assertValidStudent(input: CreateUserInput): void {
    if (!input.tenantId) {
      throw new BadRequestException({
        code: 'STUDENT_TENANT_REQUIRED',
        message: 'Un STUDENT requiere tenant_id.',
      });
    }
    if (!input.dni) {
      throw new BadRequestException({
        code: 'STUDENT_DNI_REQUIRED',
        message: 'Un STUDENT requiere DNI.',
      });
    }
    if (input.passwordHash) {
      throw new BadRequestException({
        code: 'STUDENT_NO_PASSWORD',
        message:
          'Un STUDENT no lleva password_hash (login por DNI, ver ADR-014).',
      });
    }
  }

  private assertValidStaff(input: CreateUserInput): void {
    if (!input.tenantId) {
      throw new BadRequestException({
        code: 'STAFF_TENANT_REQUIRED',
        message: 'OWNER/TRAINER requieren tenant_id.',
      });
    }
    if (!input.email) {
      throw new BadRequestException({
        code: 'STAFF_EMAIL_REQUIRED',
        message: 'OWNER/TRAINER requieren email.',
      });
    }
    if (!input.passwordHash) {
      throw new BadRequestException({
        code: 'STAFF_PASSWORD_REQUIRED',
        message: 'OWNER/TRAINER requieren password_hash.',
      });
    }
    if (input.dni) {
      throw new BadRequestException({
        code: 'STAFF_NO_DNI',
        message: 'OWNER/TRAINER no llevan DNI en MVP.',
      });
    }
    if (input.role === 'OWNER' && input.trainerId) {
      throw new BadRequestException({
        code: 'OWNER_NO_TRAINER',
        message: 'Un OWNER no puede tener trainer.',
      });
    }
    if (input.role === 'TRAINER' && input.trainerId) {
      throw new BadRequestException({
        code: 'TRAINER_NO_TRAINER',
        message: 'Un TRAINER no puede tener otro trainer.',
      });
    }
  }
}
