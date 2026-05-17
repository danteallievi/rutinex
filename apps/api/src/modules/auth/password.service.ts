import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Alfabeto para passwords generadas por el sistema.
 * `[a-zA-Z0-9]` menos los caracteres ambiguos `0`, `O`, `o`, `1`, `l`, `I`
 * (ver `docs/04-auth.md` → "Política de password generada"). 56 símbolos.
 */
export const GENERATED_PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** Largo en caracteres de la password generada. */
export const GENERATED_PASSWORD_LENGTH = 16;

/**
 * Parámetros Argon2id (OWASP 2024, ver `docs/04-auth.md`).
 *
 * Encapsulados para tests; cualquier cambio acá invalida hashes existentes
 * (Argon2 lleva los params dentro del string del hash, así que `verify`
 * sigue funcionando, pero los hashes nuevos quedan con params nuevos).
 */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService {
  /** Hashea una password en plano con Argon2id. */
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON2_OPTIONS);
  }

  /**
   * Verifica que la password en plano corresponda al hash. Devuelve `false`
   * si el hash está corrupto o usa un algoritmo no soportado, en lugar de
   * propagar la excepción (queremos un 401 genérico en login, no un 500).
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /**
   * Genera una password aleatoria con CSPRNG (`crypto.randomBytes`) y
   * rejection sampling para evitar sesgo modular. Largo y alfabeto fijos
   * por la política de `docs/04-auth.md`.
   */
  generate(): string {
    const alphabet = GENERATED_PASSWORD_ALPHABET;
    const length = GENERATED_PASSWORD_LENGTH;
    const maxValid = 256 - (256 % alphabet.length);
    const out: string[] = [];

    while (out.length < length) {
      const buf = randomBytes(length);
      for (const byte of buf) {
        if (byte >= maxValid) continue;
        out.push(alphabet[byte % alphabet.length]!);
        if (out.length === length) break;
      }
    }

    return out.join('');
  }
}
