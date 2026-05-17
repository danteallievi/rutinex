/**
 * Extrae el slug del tenant a partir del `Host` header.
 *
 * Casos:
 *   localhost:3000              → null  (landing)
 *   www.localhost:3000          → null  (reservado)
 *   app.localhost:3000          → null  (admin, futuro)
 *   olimpo.localhost:3000       → 'olimpo'
 *   rutinex.app                 → null
 *   app.rutinex.app             → null
 *   olimpo.rutinex.app          → 'olimpo'
 *
 * El frontend NO valida acá si el slug existe; solo extrae el candidato.
 * La validación de existencia la hace el API (GET /tenants/by-slug/:slug).
 */

const RESERVED_HOST_PREFIXES = new Set(['www', 'app']);

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
