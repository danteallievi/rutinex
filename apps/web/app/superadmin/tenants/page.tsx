import Link from 'next/link';
import { mockTenants, type MockTenant } from '@/lib/mock-data';

type StatusFilter = 'all' | 'active' | 'inactive';

interface FilterTab {
  key: StatusFilter;
  label: string;
  count: number;
}

export default function TenantsPage() {
  const tenants = mockTenants;
  const total = tenants.length;
  const activeCount = tenants.filter((t) => t.isActive).length;
  const inactiveCount = total - activeCount;

  const filters: FilterTab[] = [
    { key: 'all', label: 'Todos', count: total },
    { key: 'active', label: 'Activos', count: activeCount },
    { key: 'inactive', label: 'Inactivos', count: inactiveCount },
  ];

  return (
    <div className="flex flex-col gap-7">
      <PageHeader activeCount={activeCount} inactiveCount={inactiveCount} />
      <Toolbar filters={filters} shown={total} total={total} />
      <DesktopTable tenants={tenants} />
      <MobileList tenants={tenants} />
    </div>
  );
}

function PageHeader({
  activeCount,
  inactiveCount,
}: {
  activeCount: number;
  inactiveCount: number;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
          <span className="text-brand-primary">/</span>
          superadmin
          <span className="text-border">›</span>
          tenants
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[34px]">
          Tenants
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          <span className="text-foreground">{activeCount}</span> activos
          <span className="mx-2 text-border">·</span>
          <span className="text-foreground">{inactiveCount}</span> inactivos
          <span className="mx-2 text-border">·</span>
          gestión sales-led, cobrado fuera del sistema
        </p>
      </div>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-sm border border-border bg-muted/40 px-3 py-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
        >
          Exportar CSV
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
            .csv
          </span>
        </button>
        <button
          type="button"
          className="group inline-flex items-center justify-center gap-2 rounded-sm bg-brand-primary px-4 py-2 text-[13px] font-semibold text-[#0a0a0a] shadow-[0_0_0_1px_rgba(249,115,22,0.6),0_8px_24px_-8px_rgba(249,115,22,0.55)] transition-all hover:shadow-[0_0_0_1px_rgba(249,115,22,0.8),0_10px_30px_-8px_rgba(249,115,22,0.7)]"
        >
          <span aria-hidden className="text-[15px] font-bold leading-none">
            +
          </span>
          Nuevo tenant
        </button>
      </div>
    </header>
  );
}

function Toolbar({
  filters,
  shown,
  total,
}: {
  filters: FilterTab[];
  shown: number;
  total: number;
}) {
  return (
    <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 items-center gap-2 rounded-sm border border-border/80 bg-[#0c0c0c] px-3 py-2 transition-colors focus-within:border-brand-primary/60 sm:max-w-md">
        <SearchIcon />
        <input
          type="text"
          placeholder="Buscar por slug o nombre..."
          className="w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
        />
        <kbd className="hidden rounded-sm border border-border/80 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
          /
        </kbd>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div
          role="tablist"
          aria-label="Filtrar por estado"
          className="inline-flex items-center gap-0.5 rounded-sm border border-border/80 bg-[#0c0c0c] p-0.5"
        >
          {filters.map((filter, idx) => {
            const active = idx === 0;
            return (
              <button
                key={filter.key}
                type="button"
                role="tab"
                aria-selected={active}
                className={`relative inline-flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {filter.label}
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    active ? 'text-foreground/80' : 'text-muted-foreground/70'
                  }`}
                >
                  {filter.count}
                </span>
              </button>
            );
          })}
        </div>

        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Mostrando{' '}
          <span className="tabular-nums text-foreground">{shown}</span> de{' '}
          <span className="tabular-nums text-foreground">{total}</span>
        </span>
      </div>
    </section>
  );
}

function DesktopTable({ tenants }: { tenants: MockTenant[] }) {
  return (
    <div className="hidden overflow-hidden rounded-sm border border-border/70 bg-[#0a0a0a] md:block">
      <div className="grid grid-cols-[1.4fr_1.8fr_0.9fr_0.7fr_0.7fr_0.9fr_1.1fr] border-b border-border/70 bg-[#0c0c0c] px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
        <span>Slug</span>
        <span>Nombre</span>
        <span>Estado</span>
        <span className="text-right">Alumnos</span>
        <span className="text-right">Trainers</span>
        <span>Creado</span>
        <span className="text-right">Acciones</span>
      </div>
      <ul className="divide-y divide-border/60">
        {tenants.map((tenant) => (
          <TenantRow key={tenant.id} tenant={tenant} />
        ))}
      </ul>
    </div>
  );
}

function TenantRow({ tenant }: { tenant: MockTenant }) {
  return (
    <li className="group relative grid grid-cols-[1.4fr_1.8fr_0.9fr_0.7fr_0.7fr_0.9fr_1.1fr] items-center gap-2 px-5 py-3 transition-colors hover:bg-muted/30">
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-[3px] rounded-r-sm opacity-0 transition-opacity group-hover:opacity-100"
        style={{ backgroundColor: tenant.branding.primaryColor }}
      />
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full ring-1 ring-inset ring-border"
          style={{ backgroundColor: tenant.branding.primaryColor }}
        />
        <code className="truncate font-mono text-[12.5px] text-foreground">
          {tenant.slug}
        </code>
      </div>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-[13.5px] font-medium text-foreground">
          {tenant.name}
        </span>
        <span className="truncate font-mono text-[10.5px] text-muted-foreground/70">
          id · {tenant.id}
        </span>
      </div>
      <StatusBadge active={tenant.isActive} />
      <span className="text-right font-mono text-[13px] tabular-nums text-foreground">
        {tenant.studentsCount}
      </span>
      <span className="text-right font-mono text-[13px] tabular-nums text-foreground">
        {tenant.trainersCount}
      </span>
      <CreatedAt iso={tenant.createdAt} />
      <RowActions tenant={tenant} />
    </li>
  );
}

function RowActions({ tenant }: { tenant: MockTenant }) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <Link
        href={`/superadmin/tenants/${tenant.slug}`}
        className="rounded-sm border border-transparent px-2 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
      >
        Ver
      </Link>
      <button
        type="button"
        className="hidden rounded-sm border border-transparent px-2 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground xl:inline-block"
        title="Resetear password del OWNER"
      >
        Reset OWNER
      </button>
      <ToggleSwitch active={tenant.isActive} />
    </div>
  );
}

function ToggleSwitch({ active }: { active: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      title={active ? 'Activo' : 'Inactivo'}
      className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
        active
          ? 'border-brand-primary/60 bg-brand-primary/30'
          : 'border-border bg-muted'
      }`}
    >
      <span
        className={`absolute top-1/2 -translate-y-1/2 size-3.5 rounded-full transition-all ${
          active
            ? 'left-[18px] bg-brand-primary shadow-[0_0_8px_var(--brand-primary)]'
            : 'left-[3px] bg-muted-foreground/70'
        }`}
      />
    </button>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  if (active) {
    return (
      <span className="inline-flex w-fit items-center gap-1.5 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
        <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
        Activo
      </span>
    );
  }
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-sm border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/70" />
      Inactivo
    </span>
  );
}

function CreatedAt({ iso }: { iso: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[12.5px] text-foreground">{formatShort(iso)}</span>
      <span className="font-mono text-[10.5px] text-muted-foreground/70">
        {formatRelative(iso)}
      </span>
    </div>
  );
}

function MobileList({ tenants }: { tenants: MockTenant[] }) {
  return (
    <ul className="flex flex-col gap-2.5 md:hidden">
      {tenants.map((tenant) => (
        <li
          key={tenant.id}
          className="relative overflow-hidden rounded-sm border border-border/70 bg-[#0a0a0a] p-4"
        >
          <span
            aria-hidden
            className="absolute inset-y-3 left-0 w-[3px] rounded-r-sm"
            style={{ backgroundColor: tenant.branding.primaryColor }}
          />
          <div className="flex items-start justify-between gap-3 pl-2">
            <div className="flex min-w-0 flex-col leading-tight">
              <div className="flex items-center gap-2">
                <code className="truncate font-mono text-[12px] text-muted-foreground">
                  {tenant.slug}
                </code>
                <StatusBadge active={tenant.isActive} />
              </div>
              <span className="mt-1 truncate text-[14px] font-medium text-foreground">
                {tenant.name}
              </span>
            </div>
            <ToggleSwitch active={tenant.isActive} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 pl-2 text-[11px]">
            <Stat label="Alumnos" value={tenant.studentsCount} />
            <Stat label="Trainers" value={tenant.trainersCount} />
            <Stat label="Creado" value={formatShort(tenant.createdAt)} mono />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 pl-2">
            <Link
              href={`/superadmin/tenants/${tenant.slug}`}
              className="rounded-sm border border-border bg-muted/40 px-3 py-1.5 text-[12px] font-medium text-foreground"
            >
              Ver detalle
            </Link>
            <button
              type="button"
              className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
            >
              Reset OWNER
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: number | string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/70">
        {label}
      </span>
      <span
        className={`text-[13px] text-foreground ${
          mono ? 'font-mono text-[12px]' : 'tabular-nums'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-muted-foreground"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

// --- date helpers ---

const SHORT_MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

function formatShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getUTCDate();
  const month = SHORT_MONTHS[d.getUTCMonth()] ?? '';
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

// Reference "now" fixed to 2026-05-17 to keep mock output deterministic
// (matches the simulated current date of the sprint).
const REFERENCE_NOW = Date.UTC(2026, 4, 17);

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = REFERENCE_NOW - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return 'hoy';
  if (days < 2) return 'hace 1 día';
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  if (months < 2) return 'hace 1 mes';
  if (months < 12) return `hace ${months} meses`;
  const years = Math.floor(months / 12);
  if (years < 2) return 'hace 1 año';
  return `hace ${years} años`;
}
