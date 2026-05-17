'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string | null;
  code: string;
  iconPath: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Hoy',
    href: '/student',
    code: '01',
    iconPath: 'M3 12 12 4l9 8M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9',
  },
  {
    label: 'Histórico',
    href: null,
    code: '02',
    iconPath: 'M4 5h16M4 12h10M4 19h16M4 5l3-2M4 12l3-2M4 19l3-2',
  },
  {
    label: 'Progreso',
    href: null,
    code: '03',
    iconPath: 'M4 19V5m0 14h16M8 16l3-4 3 3 5-7',
  },
  {
    label: 'Perfil',
    href: null,
    code: '04',
    iconPath:
      'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.314 0-8 1.679-8 5v1h16v-1c0-3.321-4.686-5-8-5Z',
  },
];

interface StudentBottomNavProps {
  basePath: string;
}

export function StudentBottomNav({ basePath }: StudentBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const fullHref = item.href ? `${basePath}${item.href}` : null;
          const isActive =
            fullHref !== null &&
            (pathname === fullHref ||
              (item.href === '/student' && pathname.startsWith(fullHref)));

          const content = (
            <div
              className={`flex h-16 flex-col items-center justify-center gap-1 transition-colors ${
                isActive
                  ? 'text-foreground'
                  : item.href
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/40'
              }`}
            >
              <span
                aria-hidden
                className={`relative flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                  isActive ? 'bg-brand-primary text-black' : ''
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={item.iconPath} />
                </svg>
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.18em]">
                {item.label}
              </span>
            </div>
          );

          return (
            <li key={item.label} className="contents">
              {fullHref ? (
                <Link
                  href={fullHref}
                  aria-current={isActive ? 'page' : undefined}
                  className="flex items-stretch justify-center"
                >
                  {content}
                </Link>
              ) : (
                <span
                  aria-disabled
                  title="Próximamente"
                  className="flex items-stretch justify-center cursor-not-allowed select-none"
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
