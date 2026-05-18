import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body de `PATCH /users/:id`. Sólo nombre/apellido y el toggle `isActive`.
 * Email, DNI, role, trainerId no se editan en MVP — si hace falta cambiar
 * uno, se borra y se vuelve a crear.
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
