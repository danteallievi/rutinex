import type { CookieOptions, Response } from 'express';

import { REFRESH_COOKIE_NAME } from './refresh-token.constants';

/**
 * Cookie httpOnly que transporta el refresh token en el navegador (ver
 * `docs/04-auth.md` → "Cookies de refresh" y ADR-017).
 *
 * - `httpOnly`: el JS del frontend no puede leerla → mitiga XSS robando el
 *   refresh.
 * - `secure`: solo se transmite por HTTPS. En dev (`NODE_ENV !== production`)
 *   se baja a `false` porque `localhost` no tiene TLS.
 * - `sameSite=lax`: el browser la envía en navegación normal y en POSTs
 *   same-site, pero no en cross-site (suficiente porque el refresh siempre
 *   sale del mismo eTLD+1 que el surface).
 * - `domain`: en prod se controla con `REFRESH_COOKIE_DOMAIN` (típicamente
 *   `.rutinex.app` para compartir cookie entre `<slug>.rutinex.app` y
 *   `superadmin.rutinex.app`). En dev queda sin domain — la cookie aplica al
 *   subdominio actual, alcanzando para el flujo manual.
 */
const COOKIE_PATH = '/';

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function getCookieDomain(): string | undefined {
  const fromEnv = process.env.REFRESH_COOKIE_DOMAIN;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv;
  }
  return undefined;
}

function buildCookieOptions(expiresAt?: Date): CookieOptions {
  const options: CookieOptions = {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: COOKIE_PATH,
  };
  const domain = getCookieDomain();
  if (domain) {
    options.domain = domain;
  }
  if (expiresAt) {
    options.expires = expiresAt;
  }
  return options;
}

export function setRefreshCookie(
  res: Response,
  token: string,
  expiresAt: Date,
): void {
  res.cookie(REFRESH_COOKIE_NAME, token, buildCookieOptions(expiresAt));
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, buildCookieOptions());
}

/**
 * Lee el refresh token de la request, priorizando el body sobre la cookie.
 * Esto permite que mobile/PWA/tests usen body sin sacrificar la cookie
 * httpOnly del web (ver ADR-017).
 */
export function extractRefreshToken(
  body: { refreshToken?: string | null },
  cookies: Record<string, string | undefined> | undefined,
): string | null {
  if (body.refreshToken && body.refreshToken.length > 0) {
    return body.refreshToken;
  }
  const fromCookie = cookies?.[REFRESH_COOKIE_NAME];
  if (fromCookie && fromCookie.length > 0) {
    return fromCookie;
  }
  return null;
}
