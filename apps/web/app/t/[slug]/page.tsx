import { notFound } from 'next/navigation';
import { ApiClientError, getTenantBySlug } from '@/lib/api-client';
import { env } from '@/lib/env';

interface Params {
  slug: string;
}

// El branding del tenant cambia poco, pero queremos verlo fresco al instante
// cuando recién se creó. No-cache para esta página.
export const dynamic = 'force-dynamic';

export default async function TenantHome({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;

  let tenant;
  try {
    tenant = await getTenantBySlug(slug);
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const primary = tenant.branding.primaryColor ?? '#f97316';
  const accent = tenant.branding.accentColor ?? '#fafafa';
  const logoUrl = tenant.branding.logoUrl;

  const cssVars = {
    '--brand-primary': primary,
    '--brand-accent': accent,
  } as React.CSSProperties;

  return (
    <main style={cssVars} className="min-h-screen flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto w-full px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`Logo de ${tenant.name}`}
                className="h-8 w-8 rounded-md object-cover"
              />
            ) : (
              <span
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-sm font-bold text-black"
                style={{ background: primary }}
              >
                {tenant.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="flex flex-col leading-tight">
              <span className="font-semibold tracking-tight">
                {tenant.name}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {tenant.slug}.{env.rootHost}
              </span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            powered by Rutinex
          </span>
        </div>
      </header>

      <section className="flex-1 max-w-5xl mx-auto w-full px-6 py-16 lg:py-24 grid lg:grid-cols-[1.2fr_1fr] gap-12">
        <div className="flex flex-col justify-center gap-6">
          <span
            className="inline-flex self-start items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
            style={{
              borderColor: `${primary}40`,
              color: primary,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: primary }}
            />
            Tenant activo
          </span>
          <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.05]">
            Bienvenido a
            <br />
            <span style={{ color: primary }}>{tenant.name}</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md">
            Acá va a vivir la app de tus alumnos: rutina del día, tracking de
            sets, PRs e histórico. En el próximo paso del roadmap arrancamos con
            la entity <code className="font-mono text-sm">User</code> y la
            autenticación.
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <button
              type="button"
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-black hover:opacity-90 transition-opacity"
              style={{ background: primary }}
            >
              Empezar a entrenar
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Ver rutinas
            </button>
          </div>
        </div>

        <aside className="rounded-2xl border border-border bg-muted/40 p-6 shadow-2xl shadow-black/20 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Branding aplicado
          </h2>
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Slug</dt>
            <dd className="font-mono">{tenant.slug}</dd>
            <dt className="text-muted-foreground">Color primario</dt>
            <dd className="flex items-center gap-2 font-mono">
              <span
                className="inline-block w-4 h-4 rounded border border-border"
                style={{ background: primary }}
              />
              {primary}
            </dd>
            <dt className="text-muted-foreground">Color acento</dt>
            <dd className="flex items-center gap-2 font-mono">
              <span
                className="inline-block w-4 h-4 rounded border border-border"
                style={{ background: accent }}
              />
              {accent}
            </dd>
            <dt className="text-muted-foreground">Logo</dt>
            <dd className="font-mono text-xs break-all">
              {logoUrl ?? 'sin logo'}
            </dd>
          </dl>
          <div className="mt-2 rounded-lg border border-border p-3 text-xs text-muted-foreground">
            Este JSON viene de{' '}
            <code className="font-mono">
              GET /tenants/by-slug/{tenant.slug}
            </code>{' '}
            (`branding` jsonb del tenant).
          </div>
        </aside>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto w-full px-6 py-6 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            {tenant.name} · subdominio servido vía middleware de Next.js
          </span>
          <a
            href={`http://${env.rootHost}`}
            className="hover:text-foreground transition-colors"
          >
            ← volver a rutinex
          </a>
        </div>
      </footer>
    </main>
  );
}
