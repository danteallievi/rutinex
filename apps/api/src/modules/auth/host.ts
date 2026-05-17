/**
 * Detección del host de la request, usada por `POST /auth/login` y
 * `POST /auth/student-login` para decidir el flujo (SUPERADMIN, tenant, o
 * ninguno).
 *
 * Fuente de verdad: `docs/03-multi-tenancy.md` y `docs/04-auth.md`.
 *
 * Reglas:
 * - Host `superadmin.<...>` → flujo SUPERADMIN.
 * - Host `<slug>.<...>` con slug válido y no reservado → flujo tenant.
 * - Cualquier otro host (bare `superadmin`, `www.*`, host sin punto, vacío)
 *   → ninguno. El service traduce eso a 401 genérico.
 */

const SUPERADMIN_SUBDOMAIN = 'superadmin';

/**
 * Prefijos de subdominio que no representan tenants. Replica la lista del
 * frontend (`apps/web/lib/subdomain.ts`); `superadmin` se chequea aparte
 * porque tiene su propio flujo.
 */
const RESERVED_TENANT_PREFIXES = new Set(['www', 'superadmin']);

/**
 * Regex DNS-safe alineado con `apps/api/src/modules/tenants/slug.ts`
 * (fuente de verdad). Lo redefino acá para evitar import cruzado entre
 * módulos siblings sólo para el regex.
 */
const SLUG_HOST_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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

/**
 * Devuelve el slug del tenant si el host es `<slug>.<...>` con slug válido,
 * o `null` en cualquier otro caso (host sin punto, prefijo reservado,
 * slug que no matchea el regex DNS-safe). No consulta la DB — sólo parsea.
 *
 * Match contra el mismo regex que valida el DTO de creación de tenant.
 * Si el primer label no matchea, devuelve `null` (no llamamos a la DB con
 * basura). La existencia real del tenant la decide el caller.
 */
export function extractTenantSlug(hostname: string | null): string | null {
  if (!hostname) return null;
  const dot = hostname.indexOf('.');
  if (dot <= 0) return null;
  const first = hostname.slice(0, dot);
  if (RESERVED_TENANT_PREFIXES.has(first)) return null;
  if (!SLUG_HOST_REGEX.test(first)) return null;
  return first;
}
