/**
 * Acceso tipado a las env vars del frontend. Todo lo que se exponga al cliente
 * tiene que empezar con NEXT_PUBLIC_ (lo bakea Next.js en build time).
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copiá apps/web/.env.example a apps/web/.env.`,
    );
  }
  return value;
}

export const env = {
  apiUrl: required('NEXT_PUBLIC_API_URL', process.env.NEXT_PUBLIC_API_URL),
  rootHost: required(
    'NEXT_PUBLIC_ROOT_HOST',
    process.env.NEXT_PUBLIC_ROOT_HOST,
  ),
};
