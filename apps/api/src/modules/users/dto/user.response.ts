import type { User, UserRole } from '../entities/user.entity';

/**
 * Shape público de un user (sin `password_hash`, sin `tenantId` redundante,
 * sin `isSuperadmin` — esta superficie es tenant-scoped). Lo consumen
 * `GET /users`, `PATCH /users/:id` y como parte del body de `POST /users`.
 */
export interface UserResponse {
  id: string;
  role: UserRole | null;
  email: string | null;
  dni: string | null;
  firstName: string;
  lastName: string;
  trainerId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    dni: user.dni,
    firstName: user.firstName,
    lastName: user.lastName,
    trainerId: user.trainerId,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Response de `POST /users`. La password generada se incluye sólo cuando
 * el rol creado lleva password (TRAINER); para STUDENT, `generatedPassword`
 * queda `undefined` (login por DNI, ADR-014).
 */
export interface CreateUserResponse {
  user: UserResponse;
  generatedPassword?: string;
}

/**
 * Response de `GET /users` (paginación offset, ver
 * `docs/05-api-conventions.md` → "Paginación").
 */
export interface PaginatedUsersResponse {
  data: UserResponse[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Response de `POST /users/:id/reset-password`. La password se devuelve una
 * sola vez en plano — no se loggea, no se guarda.
 */
export interface ResetPasswordResponse {
  generatedPassword: string;
}
