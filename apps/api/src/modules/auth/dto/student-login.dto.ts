import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Login del STUDENT — solo `dni`. El slug del tenant viene del host.
 *
 * El regex acepta cualquier string de dígitos (longitud razonable). Si más
 * adelante validamos formato AR/UY/etc. específico, se ajusta acá.
 */
export class StudentLoginDto {
  @IsString()
  @MinLength(4)
  @MaxLength(20)
  @Matches(/^[0-9]+$/, {
    message: 'dni debe contener solo dígitos',
  })
  dni!: string;
}
