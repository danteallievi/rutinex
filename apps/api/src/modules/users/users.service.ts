import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { User, UserRole } from './entities/user.entity';

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
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
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
   * Prende/apaga al user (toggle del `is_active`).
   */
  async setActive(id: string, isActive: boolean): Promise<void> {
    const result = await this.usersRepository.update({ id }, { isActive });
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
    const result = await this.usersRepository.update(
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
