import Link from 'next/link';
import type { ReactNode } from 'react';

interface NavItem {
  label: string;
  href: string;
  shortcut: string;
  active?: boolean;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  {
    label: 'Tenants',
    href: '/superadmin/tenants',
    shortcut: 'T',
    active: true,
  },
  { label: 'Operadores', href: '#', shortcut: 'O', disabled: true },
  { label: 'Auditoría', href: '#', shortcut: 'A', disabled: true },
  { label: 'Configuración', href: '#', shortcut: 'C', disabled: true },
];

const operator = {
  name: 'Dante Allievi',
  email: 'dante@rutinex.app',
};

export default function SuperadminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-dvh bg-[#070707] text-foreground">
      <Header />
      <NavBar />
      <main className="mx-auto w-full max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-[1400px] border-t border-border/60 px-5 py-6 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>Rutinex Operations Console</span>
          <span className="font-mono text-[10px] tracking-normal">
            build · mock-7.5
          </span>
        </div>
      </footer>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-[#070707]/85 backdrop-blur supports-[backdrop-filter]:bg-[#070707]/70">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-5 py-3.5 sm:px-8">
        <div className="flex items-center gap-3">
          <Link
            href="/superadmin/tenants"
            className="group flex items-center gap-3"
          >
            <BrandMark />
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-medium tracking-tight text-foreground">
                Rutinex
                <span className="ml-1.5 text-muted-foreground">·</span>
                <span className="ml-1.5 font-mono text-[12px] uppercase tracking-[0.14em] text-muted-foreground group-hover:text-foreground">
                  superadmin
                </span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
                operations console
              </span>
            </div>
          </Link>

          <span className="ml-2 hidden items-center gap-1.5 rounded-sm border border-brand-primary/40 bg-brand-primary/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-brand-primary sm:inline-flex">
            <span className="size-1.5 rounded-full bg-brand-primary shadow-[0_0_8px_var(--brand-primary)]" />
            internal
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className="hidden flex-col items-end leading-tight md:flex">
            <span className="text-[13px] font-medium text-foreground">
              {operator.name}
            </span>
            <span className="font-mono text-[10px] tracking-tight text-muted-foreground">
              {operator.email}
            </span>
          </div>
          <Avatar name={operator.name} />
          <button
            type="button"
            className="rounded-sm border border-border/80 bg-muted/30 px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}

function NavBar() {
  return (
    <nav className="border-b border-border/60 bg-[#0a0a0a]">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-1 overflow-x-auto px-5 sm:px-8">
        {navItems.map((item) => {
          const baseClasses =
            'group relative flex items-center gap-2 whitespace-nowrap px-3 py-3 text-[12.5px] font-medium tracking-tight transition-colors';
          if (item.disabled) {
            return (
              <span
                key={item.label}
                className={`${baseClasses} cursor-not-allowed text-muted-foreground/60`}
                aria-disabled
              >
                {item.label}
                <span className="hidden font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground/40 sm:inline">
                  soon
                </span>
              </span>
            );
          }
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`${baseClasses} ${
                item.active
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
              <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground/50">
                {item.shortcut}
              </span>
              {item.active ? (
                <span className="absolute inset-x-2 -bottom-px h-px bg-brand-primary" />
              ) : null}
            </Link>
          );
        })}
        <div className="ml-auto hidden items-center gap-2 py-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/70 md:flex">
          <span className="size-1.5 rounded-full bg-emerald-500/80 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
          api · ok
          <span className="text-border">·</span>
          db · ok
        </div>
      </div>
    </nav>
  );
}

function BrandMark() {
  return (
    <span
      aria-hidden
      className="relative flex size-8 items-center justify-center rounded-sm border border-border/80 bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a]"
    >
      <span className="absolute inset-px rounded-[3px] bg-[radial-gradient(circle_at_30%_20%,rgba(249,115,22,0.35),transparent_60%)]" />
      <span className="relative font-mono text-[13px] font-semibold leading-none text-brand-primary">
        R
      </span>
      <span className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full bg-brand-primary shadow-[0_0_6px_var(--brand-primary)]" />
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span className="flex size-9 items-center justify-center rounded-full border border-border/80 bg-muted text-[12px] font-medium text-foreground">
      {initials}
    </span>
  );
}
