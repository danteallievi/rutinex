/**
 * Constantes del refresh token (Step 9). Centralizadas para que el service,
 * el módulo de auth y los tests las consuman de una única fuente.
 *
 * Fuente de verdad de la política: `docs/04-auth.md` → "Refresh token".
 */

/** Bytes de entropía del refresh token (luego se codifica en base64url). */
export const REFRESH_TOKEN_BYTES = 64;

/** Largo del hash SHA-256 en hex (siempre 64 chars). */
export const REFRESH_TOKEN_HASH_LENGTH = 64;

/** TTL del refresh token en milisegundos. 30 días. */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Nombre de la cookie httpOnly que transporta el refresh en el web. */
export const REFRESH_COOKIE_NAME = 'rutinex_refresh';
