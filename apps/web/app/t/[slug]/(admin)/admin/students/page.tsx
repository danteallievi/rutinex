import Link from 'next/link';
import { olimpoStudents, olimpoTrainers, type MockUser } from '@/lib/mock-data';

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'sin ingresos';
  const now = Date.now();
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';

  const diffMs = now - t;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.round(hours / 24);
  if (days < 7) return `hace ${days} d`;
  if (days < 30) return `hace ${Math.round(days / 7)} sem`;
  return `hace ${Math.round(days / 30)} m`;
}

function trainerNameFor(student: MockUser): string {
  if (!student.trainerId) return 'sin asignar';
  const t = olimpoTrainers.find((x) => x.id === student.trainerId);
  if (!t) return 'sin asignar';
  return `${t.firstName} ${t.lastName.charAt(0)}.`;
}

function studentInitials(student: MockUser): string {
  return `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
}

export default async function StudentsPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;

  const students = olimpoStudents;
  const activeCount = students.filter((s) => s.isActive).length;
  const inactiveCount = students.length - activeCount;

  return (
    <div className="px-5 lg:px-8 py-8 lg:py-10">
      <div className="mx-auto max-w-6xl">
        {/* Page header */}
        <header className="mb-8 lg:mb-10 border-b border-border pb-7">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-2">
            <span>Panel</span>
            <span aria-hidden>/</span>
            <span className="text-brand-primary">Alumnos</span>
          </div>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl lg:text-[40px] font-semibold tracking-tight leading-[1.05]">
                Alumnos
              </h1>
              <p className="mt-2 text-[15px] text-muted-foreground">
                <span className="tabular-nums text-foreground">
                  {students.length}
                </span>{' '}
                en total ·{' '}
                <span className="tabular-nums text-foreground">
                  {activeCount}
                </span>{' '}
                activos
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
              style={{ background: 'var(--brand-primary)' }}
            >
              <span className="text-base leading-none">+</span>
              Nuevo alumno
            </button>
          </div>
        </header>

        {/* Filters row */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground"
            >
              Buscar
            </span>
            <input
              type="search"
              placeholder="Nombre o DNI..."
              className="w-full rounded-lg border border-border bg-muted/30 pl-[72px] pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-brand-primary/60 focus:bg-muted/50 transition-colors"
            />
          </div>

          {/* Segmented control */}
          <div
            role="tablist"
            aria-label="Filtrar por estado"
            className="inline-flex items-center gap-0 rounded-lg border border-border bg-background p-1 self-start"
          >
            {[
              { key: 'all', label: 'Todos', count: students.length },
              { key: 'active', label: 'Activos', count: activeCount },
              { key: 'inactive', label: 'Inactivos', count: inactiveCount },
            ].map((tab, i) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={i === 0}
                className={
                  i === 0
                    ? 'inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground'
                    : 'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors'
                }
              >
                {tab.label}
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                  {tab.count.toString().padStart(2, '0')}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {[
                  { label: '#', className: 'w-10' },
                  { label: 'Nombre', className: '' },
                  { label: 'DNI', className: 'w-32' },
                  { label: 'Trainer', className: 'w-40' },
                  { label: 'Último ingreso', className: 'w-40' },
                  { label: 'Estado', className: 'w-28' },
                  { label: '', className: 'w-20' },
                ].map((th) => (
                  <th
                    key={th.label || 'actions'}
                    className={`px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium ${th.className}`}
                  >
                    {th.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {students.map((student, i) => (
                <tr
                  key={student.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-4 align-middle font-mono text-[10px] text-muted-foreground tabular-nums">
                    {(i + 1).toString().padStart(2, '0')}
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-semibold text-brand-primary">
                        {studentInitials(student)}
                      </span>
                      <div className="leading-tight min-w-0">
                        <p className="font-medium truncate">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {student.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-middle font-mono text-xs text-muted-foreground tabular-nums">
                    {student.dni}
                  </td>
                  <td className="px-4 py-4 align-middle text-xs">
                    {trainerNameFor(student)}
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {formatRelative(student.lastLoginAt)}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <StatusBadge active={student.isActive} />
                  </td>
                  <td className="px-4 py-4 align-middle text-right">
                    <Link
                      href={`/admin/students/${student.id}`}
                      className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-brand-primary transition-colors"
                      aria-label={`Ver alumno ${student.firstName} ${student.lastName}`}
                    >
                      Ver
                      <span aria-hidden>→</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="md:hidden flex flex-col gap-3">
          {students.map((student) => (
            <li key={student.id}>
              <Link
                href={`/admin/students/${student.id}`}
                className="block rounded-xl border border-border bg-background p-4 hover:border-brand-primary/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-sm font-semibold text-brand-primary">
                    {studentInitials(student)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium truncate">
                      {student.firstName} {student.lastName}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">
                      DNI {student.dni}
                    </p>
                  </div>
                  <StatusBadge active={student.isActive} />
                </div>
                <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
                  <div className="leading-tight">
                    <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                      Trainer
                    </p>
                    <p className="mt-0.5 text-foreground/90 truncate">
                      {trainerNameFor(student)}
                    </p>
                  </div>
                  <div className="leading-tight text-right">
                    <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                      Último ingreso
                    </p>
                    <p className="mt-0.5 text-foreground/90">
                      {formatRelative(student.lastLoginAt)}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {students.length.toString().padStart(2, '0')} resultados · tenant{' '}
          {slug}
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300">
        <span className="h-1 w-1 rounded-full bg-emerald-300" />
        Activo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
      <span className="h-1 w-1 rounded-full bg-muted-foreground" />
      Inactivo
    </span>
  );
}
