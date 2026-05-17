'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  code: string;
  enabled: boolean;
}

interface AdminMobileNavProps {
  items: NavItem[];
  tenantName: string;
  tenantSlug: string;
  ownerName: string;
  ownerInitials: string;
  primary: string;
  isDemoTenant: boolean;
}

export function AdminMobileNav({
  items,
  tenantName,
  tenantSlug,
  ownerName,
  ownerInitials,
  primary,
  isDemoTenant,
}: AdminMobileNavProps) {
  const [open, setOpen] = useState(false);

  // Lock body scroll while drawer is open.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
    return;
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted transition-colors"
      >
        <span className="flex flex-col gap-[3px]">
          <span className="block h-[1.5px] w-4 bg-current" />
          <span className="block h-[1.5px] w-4 bg-current" />
          <span className="block h-[1.5px] w-4 bg-current" />
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <aside className="absolute right-0 top-0 h-full w-[86%] max-w-[340px] border-l border-border bg-background flex flex-col">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold text-black"
                  style={{ background: primary }}
                >
                  {tenantName.charAt(0).toUpperCase()}
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold tracking-tight">
                    {tenantName}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {tenantSlug} / admin
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors"
              >
                Cerrar
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-5">
              <div className="px-3 pb-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Navegación
                </span>
              </div>
              <ul className="flex flex-col gap-0.5">
                {items.map((item) =>
                  item.enabled ? (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-md px-3 py-3 text-[15px] text-foreground/85 hover:bg-muted/60 hover:text-foreground transition-colors"
                      >
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {item.code}
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  ) : (
                    <li key={item.href}>
                      <span className="flex items-center gap-3 rounded-md px-3 py-3 text-[15px] text-muted-foreground">
                        <span className="font-mono text-[10px] text-muted-foreground/60">
                          {item.code}
                        </span>
                        <span className="flex-1">{item.label}</span>
                        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70 border border-border rounded px-1.5 py-0.5">
                          Pronto
                        </span>
                      </span>
                    </li>
                  ),
                )}
              </ul>

              {isDemoTenant ? (
                <div className="mt-7 mx-1 rounded-lg border border-border bg-muted/30 px-3.5 py-3">
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Datos ficticios. Sprint visual · Olimpo.
                  </p>
                </div>
              ) : null}
            </nav>

            <div className="border-t border-border px-4 py-4">
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-xs font-semibold"
                  style={{ color: primary }}
                >
                  {ownerInitials}
                </span>
                <div className="flex-1 min-w-0 leading-tight">
                  <p className="truncate text-sm font-medium">{ownerName}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Owner
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
        </div>
      ) : null}
    </>
  );
}
