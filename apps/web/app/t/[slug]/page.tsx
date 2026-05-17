import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ApiClientError,
  getTenantBySlug,
  type PublicTenant,
} from '@/lib/api-client';
import { env } from '@/lib/env';
import { DEMO_TENANT_SLUG, olimpoTenant } from '@/lib/mock-data';

interface Params {
  slug: string;
}

// El branding del tenant cambia poco, pero queremos verlo fresco al instante.
export const dynamic = 'force-dynamic';

export default async function TenantHome({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;

  let tenant: PublicTenant;
  try {
    tenant = await getTenantBySlug(slug);
  } catch (err) {
    // Si el API responde 404 → no existe el tenant.
    if (err instanceof ApiClientError && err.status === 404) {
      notFound();
    }
    // Cualquier otro error y estamos en el tenant de demo: fallback al mock.
    if (slug === DEMO_TENANT_SLUG) {
      tenant = {
        id: olimpoTenant.id,
        slug: olimpoTenant.slug,
        name: olimpoTenant.name,
        branding: olimpoTenant.branding,
      };
    } else {
      throw err;
    }
  }

  const primary = tenant.branding.primaryColor ?? '#f97316';
  const accent = tenant.branding.accentColor ?? '#fafafa';
  const logoUrl = tenant.branding.logoUrl;

  const cssVars = {
    '--brand-primary': primary,
    '--brand-accent': accent,
  } as React.CSSProperties;

  return (
    <main
      style={cssVars}
      className="relative min-h-screen flex flex-col bg-background text-foreground"
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div
          className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-3xl opacity-25"
          style={{
            background: `radial-gradient(circle, ${primary}66, transparent 60%)`,
          }}
        />
      </div>

      <header className="border-b border-border/70">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`Logo de ${tenant.name}`}
                className="h-9 w-9 rounded-lg object-cover"
              />
            ) : (
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-black"
                style={{ background: primary }}
              >
                {tenant.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="flex flex-col leading-tight">
              <span className="font-semibold tracking-tight">
                {tenant.name}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {tenant.slug}.{env.rootHost}
              </span>
            </div>
          </div>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:inline">
            powered by rutinex
          </span>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="flex w-full max-w-3xl flex-col items-center gap-12 text-center">
          <div className="flex flex-col gap-5">
            <span
              className="inline-flex items-center gap-2 self-center rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em]"
              style={{ borderColor: `${primary}55`, color: primary }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: primary }}
              />
              Demo · {tenant.slug}
            </span>
            <h1 className="text-4xl font-semibold tracking-tight lg:text-6xl">
              Elegí qué ver
            </h1>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-muted-foreground lg:text-lg">
              Estás viendo el subdominio de{' '}
              <strong className="font-medium text-foreground">
                {tenant.name}
              </strong>
              . Esta página existe sólo para el mockup comercial: elegí desde
              qué rol querés explorar la app.
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2">
            <DemoChoice
              href="/admin"
              label="Ver como admin"
              caption="Owner / Entrenador · gestión de alumnos, rutinas y dashboards"
              primary={primary}
              highlighted
            />
            <DemoChoice
              href="/student"
              label="Ver como alumno"
              caption="Acceso por DNI · rutina del día, tracking de PRs"
              primary={primary}
            />
          </div>

          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            En producción, los alumnos entran con su DNI y los entrenadores con
            email + contraseña. Esto es navegación libre del mockup.
          </p>
        </div>
      </section>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
          <span>
            {tenant.name} · subdominio servido vía middleware de Next.js
          </span>
          <a
            href={`http://${env.rootHost}`}
            className="transition-colors hover:text-foreground"
          >
            ← volver a rutinex
          </a>
        </div>
      </footer>
    </main>
  );
}

interface DemoChoiceProps {
  href: string;
  label: string;
  caption: string;
  primary: string;
  highlighted?: boolean;
}

function DemoChoice({
  href,
  label,
  caption,
  primary,
  highlighted = false,
}: DemoChoiceProps) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col items-start gap-4 overflow-hidden rounded-2xl border border-border bg-background/40 p-6 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:bg-muted/40 lg:p-8"
      style={
        highlighted
          ? {
              borderColor: `${primary}55`,
              boxShadow: `0 30px 60px -30px ${primary}66`,
            }
          : undefined
      }
    >
      {highlighted ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-40 blur-3xl"
          style={{ background: primary }}
        />
      ) : null}
      <span
        className="font-mono text-[11px] uppercase tracking-[0.18em]"
        style={{ color: highlighted ? primary : undefined }}
      >
        {highlighted ? '/ entrar como staff' : '/ entrar como alumno'}
      </span>
      <span className="text-2xl font-semibold tracking-tight lg:text-3xl">
        {label}
      </span>
      <span className="text-sm leading-relaxed text-muted-foreground">
        {caption}
      </span>
      <span
        className="mt-1 inline-flex items-center gap-2 text-sm font-medium transition-transform group-hover:translate-x-0.5"
        style={{ color: highlighted ? primary : undefined }}
      >
        Abrir demo
        <span aria-hidden className="font-mono text-[11px]">
          →
        </span>
      </span>
    </Link>
  );
}
