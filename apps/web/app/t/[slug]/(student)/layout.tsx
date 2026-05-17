import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  DEMO_TENANT_SLUG,
  olimpoStudents,
  olimpoTenant,
  type MockTenant,
  type MockUser,
} from '@/lib/mock-data';
import { StudentBottomNav } from './_components/student-bottom-nav';

interface StudentLayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function StudentLayout({
  children,
  params,
}: StudentLayoutProps) {
  const { slug } = await params;

  // En el sprint visual cualquier slug renderiza el tenant olimpo.
  // Cuando se conecte la data real, esto se reemplaza por un fetch por slug.
  const tenant: MockTenant = olimpoTenant;
  const isDemoTenant = slug === DEMO_TENANT_SLUG;

  const student: MockUser =
    olimpoStudents.find((u) => u.id === 'u-student-1') ?? olimpoStudents[0]!;

  const primary = tenant.branding.primaryColor;
  const accent = tenant.branding.accentColor;
  const basePath = `/t/${slug}`;

  const cssVars = {
    '--brand-primary': primary,
    '--brand-accent': accent,
  } as React.CSSProperties;

  const studentInitials =
    `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();

  // Tabs visuales del top-bar desktop. Sólo "Hoy" navega.
  const tabs = [
    { label: 'Hoy', href: '/student', code: '01', enabled: true },
    { label: 'Histórico', href: null, code: '02', enabled: false },
    { label: 'Progreso', href: null, code: '03', enabled: false },
    { label: 'Perfil', href: null, code: '04', enabled: false },
  ];

  return (
    <main
      style={cssVars}
      className="min-h-screen bg-background text-foreground"
    >
      {/* Sticky top header — common to mobile and desktop */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-3.5 lg:px-8 lg:py-4">
          <Link
            href={`${basePath}/student`}
            className="flex items-center gap-2.5 group"
          >
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-black text-black transition-transform group-hover:rotate-[-3deg] group-hover:scale-105"
              style={{ background: primary }}
            >
              {tenant.name.charAt(0).toUpperCase()}
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-semibold tracking-tight">
                {tenant.name}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Atleta
                {isDemoTenant ? ' · Demo' : ''}
              </span>
            </div>
          </Link>

          {/* Desktop tabs */}
          <nav
            aria-label="Secciones"
            className="hidden lg:flex items-center gap-1"
          >
            {tabs.map((tab) => {
              const isActive = tab.enabled && tab.href === '/student';
              const className = `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-foreground text-background'
                  : tab.enabled
                    ? 'text-foreground/70 hover:bg-muted hover:text-foreground'
                    : 'text-muted-foreground/60 cursor-not-allowed'
              }`;
              const inner = (
                <>
                  <span
                    className={`font-mono text-[10px] ${
                      isActive
                        ? 'text-background/60'
                        : 'text-muted-foreground/70'
                    }`}
                  >
                    {tab.code}
                  </span>
                  <span>{tab.label}</span>
                </>
              );
              return tab.enabled && tab.href ? (
                <Link
                  key={tab.label}
                  href={`${basePath}${tab.href}`}
                  className={className}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {inner}
                </Link>
              ) : (
                <span
                  key={tab.label}
                  className={className}
                  title="Próximamente"
                >
                  {inner}
                </span>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-semibold tracking-tight">
                Hola, {student.firstName}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                DNI {student.dni}
              </span>
            </div>
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-xs font-semibold"
              style={{
                borderColor: `color-mix(in srgb, ${primary} 50%, transparent)`,
                color: primary,
              }}
            >
              {studentInitials}
            </span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto w-full max-w-3xl px-5 pb-28 pt-5 lg:px-8 lg:pb-12 lg:pt-8">
        {children}
      </div>

      <StudentBottomNav basePath={basePath} />
    </main>
  );
}
