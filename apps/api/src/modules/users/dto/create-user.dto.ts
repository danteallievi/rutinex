import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import type { UserRole } from '../entities/user.entity';

/**
 * Body de `POST /users`. Sólo permite crear `TRAINER` y `STUDENT` desde acá:
 * - OWNER y SUPERADMIN se crean por otros caminos (seed CLI, panel
 *   superadmin — ver Step 13).
 *
 * El service valida la jerarquía: OWNER → puede crear TRAINER; TRAINER →
 * puede crear STUDENT (con `trainerId = creador.userId`). Cualquier otra
 * combinación es 403 `FORBIDDEN_ROLE_HIERARCHY`.
 *
 * Reglas por rol:
 * - TRAINER: `email` requerido; `dni` debe estar ausente.
 * - STUDENT: `dni` requerido (^[0-9]+$, 4-20 chars); `email` opcional.
 */
export class CreateUserDto {
  @IsIn(['TRAINER', 'STUDENT'])
  role!: Extract<UserRole, 'TRAINER' | 'STUDENT'>;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @Matches(/^[0-9]+$/, { message: 'dni debe ser numérico' })
  @MinLength(4)
  @MaxLength(20)
  dni?: string;
}
