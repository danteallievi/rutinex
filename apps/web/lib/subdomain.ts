/**
 * Extrae el slug del tenant a partir del `Host` header.
 *
 * Casos:
 *   localhost:3000              → null  (landing)
 *   www.localhost:3000          → null  (reservado)
 *   superadmin.localhost:3000   → null  (reservado, lo maneja isSuperadminHost)
 *   olimpo.localhost:3000       → 'olimpo'
 *   rutinex.app                 → null
 *   www.rutinex.app             → null
 *   superadmin.rutinex.app      → null
 *   olimpo.rutinex.app          → 'olimpo'
 *
 * El frontend NO valida acá si el slug existe; solo extrae el candidato.
 * La validación de existencia la hace el API (GET /tenants/by-slug/:slug).
 */

const RESERVED_HOST_PREFIXES = new Set(['www', 'superadmin']);

export function extractTenantSlug(
  host: string | null | undefined,
): string | null {
  if (!host) return null;

  const hostname = host.split(':')[0]?.toLowerCase() ?? '';
  if (!hostname) return null;

  const parts = hostname.split('.');
  if (parts.length < 2) return null;

  const candidate = parts[0];
  if (!candidate || RESERVED_HOST_PREFIXES.has(candidate)) return null;

  // *.localhost
  if (parts.length === 2 && parts[1] === 'localhost') {
    return candidate;
  }

  // *.rutinex.app
  if (parts.length === 3 && parts[1] === 'rutinex' && parts[2] === 'app') {
    return candidate;
  }

  return null;
}

/**
 * Devuelve `true` si el host corresponde al panel del superadmin: primer
 * label exacto `superadmin` y dominio raíz `localhost` o `rutinex.app`.
 *
 * Casos:
 *   superadmin.localhost:3000   → true
 *   superadmin.rutinex.app      → true
 *   superadmin.example.com      → false (root host no es nuestro)
 *   olimpo.localhost:3000       → false
 *   localhost:3000              → false
 */
export function isSuperadminHost(host: string | null | undefined): boolean {
  if (!host) return false;

  const hostname = host.split(':')[0]?.toLowerCase() ?? '';
  if (!hostname) return false;

  const parts = hostname.split('.');
  if (parts.length < 2) return false;
  if (parts[0] !== 'superadmin') return false;

  // superadmin.localhost
  if (parts.length === 2 && parts[1] === 'localhost') return true;
  // superadmin.rutinex.app
  if (parts.length === 3 && parts[1] === 'rutinex' && parts[2] === 'app') {
    return true;
  }

  return false;
}
