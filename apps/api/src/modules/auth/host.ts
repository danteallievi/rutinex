/**
 * Detección del host de la request, usada por `POST /auth/login` para decidir
 * el flujo (SUPERADMIN vs tenant).
 *
 * Fuente de verdad: `docs/03-multi-tenancy.md` y `docs/04-auth.md`.
 *
 * Reglas:
 * - Host `superadmin.<...>` (en prod `superadmin.rutinex.app`, en dev
 *   `superadmin.localhost[:port]`) → flujo SUPERADMIN.
 * - Cualquier otro host (incluye el bare `superadmin` sin sufijo o un host
 *   vacío) → no es SUPERADMIN. En Step 7 eso significa 401 genérico; Step 8
 *   agregará la detección de tenant.
 */

const SUPERADMIN_SUBDOMAIN = 'superadmin';

/**
 * Extrae el hostname sin puerto y en minúsculas.
 * Lee preferentemente `x-rutinex-host` (override para tests) y cae a `host`.
 */
export function extractHostname(
  headers: Record<string, string | string[] | undefined>,
): string | null {
  const raw = headers['x-rutinex-host'] ?? headers['host'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const hostname = value.split(':')[0]?.toLowerCase();
  return hostname && hostname.length > 0 ? hostname : null;
}

/**
 * `true` si el host es del surface SUPERADMIN: empieza con `superadmin.` y
 * tiene al menos un nivel más (no acepta el bare `superadmin`).
 */
export function isSuperadminHost(hostname: string | null): boolean {
  if (!hostname) return false;
  return hostname.startsWith(`${SUPERADMIN_SUBDOMAIN}.`);
}
