import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { MIN_USER_PASSWORD_LENGTH } from '../password.service';

/**
 * Body de `POST /auth/change-password`. Cubre los dos modos (forzado y
 * voluntario); el service decide cuál aplica según `user.must_change_password`.
 *
 * - Forzado (`must_change_password=true`): se ignora `currentPassword`.
 * - Voluntario: `currentPassword` es requerido. El service tira
 *   `BadRequestException` con `code: CURRENT_PASSWORD_REQUIRED` si falta.
 */
export class ChangePasswordDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(255)
  currentPassword?: string;

  @IsString()
  @MinLength(MIN_USER_PASSWORD_LENGTH)
  @MaxLength(255)
  newPassword!: string;
}
