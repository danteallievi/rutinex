/**
 * Reglas de slug. Fuente de verdad: docs/03-multi-tenancy.md.
 *
 * Si tocás algo acá, actualizá la doc.
 */

export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 63;

/**
 * Subdominios que no se pueden usar como slug porque chocan con
 * superficies propias del producto (landing, admin, api, etc.).
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'docs',
  'help',
  'mail',
  'rutinex',
  'static',
  'status',
  'support',
  'www',
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}
