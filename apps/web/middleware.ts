import { NextResponse, type NextRequest } from 'next/server';
import { extractTenantSlug, isSuperadminHost } from './lib/subdomain';

/**
 * Routing por subdominio:
 *
 *   superadmin.<root>   → rewrite a /superadmin/...
 *   <slug>.<root>       → rewrite a /t/<slug>/...
 *   <root>              → landing comercial en /
 *
 * Las rutas internas que ya empiezan en `/t/` o `/superadmin/` se respetan
 * tal cual para evitar reescrituras dobles.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get('host');

  // Superadmin tiene prioridad: queremos pisar cualquier otra heurística
  // antes de mirar tenant slugs.
  if (isSuperadminHost(host)) {
    if (req.nextUrl.pathname.startsWith('/superadmin')) {
      return NextResponse.next();
    }
    const url = req.nextUrl.clone();
    url.pathname =
      req.nextUrl.pathname === '/'
        ? '/superadmin'
        : `/superadmin${req.nextUrl.pathname}`;
    return NextResponse.rewrite(url);
  }

  const slug = extractTenantSlug(host);
  if (!slug) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith('/t/')) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/t/${slug}${req.nextUrl.pathname === '/' ? '' : req.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Todo excepto assets internos de Next, favicons y la carpeta public.
    '/((?!_next/|favicon.ico|.*\\.).*)',
  ],
};
