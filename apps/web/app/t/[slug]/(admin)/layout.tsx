import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  DEMO_TENANT_SLUG,
  mockTenants,
  olimpoOwner,
  olimpoTenant,
  type MockTenant,
} from '@/lib/mock-data';
import { AdminMobileNav } from './_components/admin-mobile-nav';

interface AdminLayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps) {
  const { slug } = await params;

  const tenant: MockTenant =
    mockTenants.find((t) => t.slug === slug) ?? olimpoTenant;
  const isDemoTenant = tenant.slug === DEMO_TENANT_SLUG;

  const primary = tenant.branding.primaryColor;
  const accent = tenant.branding.accentColor;

  const cssVars = {
    '--brand-primary': primary,
    '--brand-accent': accent,
  } as React.CSSProperties;

  const navItems = [
    { href: `/admin`, label: 'Dashboard', code: '01', enabled: true },
    {
      href: `/admin/students`,
      label: 'Alumnos',
      code: '02',
      enabled: true,
    },
    {
      href: `/admin/routines`,
      label: 'Rutinas',
      code: '03',
      enabled: false,
    },
    {
      href: `/admin/exercises`,
      label: 'Ejercicios',
      code: '04',
      enabled: false,
    },
  ];

  const ownerInitials =
    `${olimpoOwner.firstName.charAt(0)}${olimpoOwner.lastName.charAt(0)}`.toUpperCase();
  const ownerFullName = `${olimpoOwner.firstName} ${olimpoOwner.lastName}`;

  return (
    <main
      style={cssVars}
      className="min-h-screen bg-background text-foreground"
    >
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold text-black"
              style={{ background: primary }}
            >
              {tenant.name.charAt(0).toUpperCase()}
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">
                {tenant.name}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Admin
              </span>
            </div>
          </div>
          <AdminMobileNav
            items={navItems}
            tenantName={tenant.name}
            tenantSlug={tenant.slug}
            ownerName={ownerFullName}
            ownerInitials={ownerInitials}
            primary={primary}
            isDemoTenant={isDemoTenant}
          />
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[260px_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex sticky top-0 h-screen flex-col border-r border-border bg-background">
          {/* Brand */}
          <div className="border-b border-border px-6 py-5">
            <Link href="/admin" className="flex items-center gap-3 group">
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold text-black transition-transform group-hover:scale-105"
                style={{ background: primary }}
              >
                {tenant.name.charAt(0).toUpperCase()}
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-[15px] font-semibold tracking-tight">
                  {tenant.name}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Panel · Admin
                </span>
              </div>
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-6">
            <div className="px-3 pb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Navegación
              </span>
            </div>
            <ul className="flex flex-col gap-0.5">
              {navItems.map((item) => (
                <li key={item.href}>
                  {item.enabled ? (
                    <Link
                      href={item.href}
                      className="group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-foreground/80 hover:bg-muted/60 hover:text-foreground transition-colors"
                    >
                      <span className="font-mono text-[10px] text-muted-foreground group-hover:text-brand-primary transition-colors">
                        {item.code}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  ) : (
                    <span
                      className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
                      title="Próximamente"
                    >
                      <span className="font-mono text-[10px] text-muted-foreground/60">
                        {item.code}
                      </span>
                      <span className="flex-1">{item.label}</span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70 border border-border rounded px-1.5 py-0.5">
                        Pronto
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-8 px-3 pb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Demo
              </span>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3.5 py-3 mx-1">
              <p className="text-[11px] leading-snug text-muted-foreground">
                Datos ficticios. Sprint visual {isDemoTenant ? '· Olimpo' : ''}.
              </p>
              <p className="mt-1.5 font-mono text-[10px] text-muted-foreground/70">
                Step 7.5
              </p>
            </div>
          </nav>

          {/* Owner footer */}
          <div className="border-t border-border px-4 py-4">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-xs font-semibold"
                style={{ color: primary }}
              >
                {ownerInitials}
              </span>
              <div className="flex-1 min-w-0 leading-tight">
                <p className="truncate text-sm font-medium">{ownerFullName}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {olimpoOwner.role ?? 'OWNER'}
                </p>
              </div>
              <button
                type="button"
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors"
              >
                Salir
              </button>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="flex min-h-screen flex-col">
          {/* Desktop top bar */}
          <header className="hidden lg:flex items-center justify-between border-b border-border bg-background px-8 py-4">
            <div className="flex items-center gap-3">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: primary }}
              />
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                {tenant.slug} / admin
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground hidden xl:inline">
                Vista admin · Rutinex
              </span>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              >
                Salir
              </button>
            </div>
          </header>

          <div className="flex-1">{children}</div>
        </div>
      </div>
    </main>
  );
}
