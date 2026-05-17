import { ConflictException } from '@nestjs/common';

import type { User } from '../users/entities/user.entity';
import type { UsersService } from '../users/users.service';
import { MIN_USER_PASSWORD_LENGTH } from './password.service';
import type { PasswordService } from './password.service';

export interface SeedSuperadminInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Re-export con el nombre histórico que usa el CLI. Apunta a la constante
 * compartida en `password.service.ts` para evitar drift.
 */
export const MIN_HUMAN_PASSWORD_LENGTH = MIN_USER_PASSWORD_LENGTH;

/** Regex razonable para email: <local>@<host>.<tld>. No es RFC perfecto. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validaciones puras del input. Las exporto para que el CLI las use antes de
 * intentar el insert y devuelva un mensaje claro al operador.
 */
export function validateSeedInput(input: SeedSuperadminInput): void {
  const email = input.email.trim();
  if (!EMAIL_REGEX.test(email)) {
    throw new Error(`Email inválido: "${input.email}".`);
  }
  if (input.password.length < MIN_HUMAN_PASSWORD_LENGTH) {
    throw new Error(
      `La password debe tener al menos ${String(MIN_HUMAN_PASSWORD_LENGTH)} caracteres.`,
    );
  }
}

/**
 * Crea el SUPERADMIN en DB. Centraliza la lógica para que tanto el CLI
 * (`pnpm --filter @rutinex/api seed:superadmin`) como los tests E2E la
 * compartan.
 *
 * Falla con `Error` si las validaciones de input no pasan, y deja que
 * `UsersService.create` tire `ConflictException` con `code:
 * 'SUPERADMIN_EMAIL_TAKEN'` si ya existe.
 */
export async function seedSuperadmin(
  usersService: UsersService,
  passwordService: PasswordService,
  input: SeedSuperadminInput,
): Promise<User> {
  validateSeedInput(input);
  const passwordHash = await passwordService.hash(input.password);
  return usersService.create({
    tenantId: null,
    role: null,
    isSuperadmin: true,
    email: input.email.trim().toLowerCase(),
    passwordHash,
    firstName: input.firstName ?? 'Super',
    lastName: input.lastName ?? 'Admin',
    mustChangePassword: false,
  });
}

/**
 * Type guard simple para clasificar errores del seed sin acoplarse al
 * shape interno de NestJS.
 */
export function isSuperadminEmailTakenError(err: unknown): boolean {
  if (!(err instanceof ConflictException)) return false;
  const response = err.getResponse();
  if (response && typeof response === 'object' && 'code' in response) {
    return response.code === 'SUPERADMIN_EMAIL_TAKEN';
  }
  return false;
}
