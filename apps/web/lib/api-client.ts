import { env } from './env';

export interface Branding {
  primaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  branding: Branding;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicTenant {
  id: string;
  slug: string;
  name: string;
  branding: Branding;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
  code?: string;
  timestamp?: string;
  path?: string;
}

/**
 * Error tipado que devuelve el cliente cuando el API responde con !2xx. El
 * caller decide qué hacer con `status` (400/409/404/etc.) y `body.code`.
 */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError,
  ) {
    super(Array.isArray(body.message) ? body.message.join(', ') : body.message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`${env.apiUrl}${path}`, {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (!res.ok) {
    let body: ApiError;
    try {
      body = (await res.json()) as ApiError;
    } catch {
      body = { statusCode: res.status, message: res.statusText };
    }
    throw new ApiClientError(res.status, body);
  }

  return (await res.json()) as T;
}

export interface CreateTenantInput {
  slug: string;
  name: string;
  branding?: Branding;
}

export function createTenant(input: CreateTenantInput): Promise<Tenant> {
  return request<Tenant>('/tenants', { method: 'POST', json: input });
}

export function getTenantBySlug(slug: string): Promise<PublicTenant> {
  return request<PublicTenant>(`/tenants/by-slug/${encodeURIComponent(slug)}`, {
    method: 'GET',
    // Server components: no cachear, queremos branding fresco.
    cache: 'no-store',
  });
}
