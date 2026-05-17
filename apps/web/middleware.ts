import { NextResponse, type NextRequest } from 'next/server';
import { extractTenantSlug } from './lib/subdomain';

/**
 * Detecta el subdominio y reescribe a `/t/:slug`. Si no hay subdominio
 * (o es reservado: www, app), no toca nada y la request sigue al árbol
 * de rutas marketing (la landing).
 *
 * Las rutas internas que ya empiezan en `/t/` se respetan tal cual para
 * evitar reescrituras dobles.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get('host');
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
