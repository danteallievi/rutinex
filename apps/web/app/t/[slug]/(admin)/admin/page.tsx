import {
  getRoutineById,
  getStudentById,
  mockSessions,
  olimpoStudents,
  olimpoTenant,
  type MockSession,
} from '@/lib/mock-data';

function formatRelative(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diffMs = now - t;
  if (Number.isNaN(diffMs)) return '—';

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

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

interface OverviewCard {
  code: string;
  label: string;
  value: number;
  subtitle: string;
  emphasis?: boolean;
}

export default async function AdminDashboardPage() {
  const tenant = olimpoTenant;

  const activeStudents = olimpoStudents.filter((s) => s.isActive);
  const activeStudentsCount = activeStudents.length;

  const sevenDaysAgo = Date.now() - 7 * 86_400_000;
  const sessionsThisWeek = mockSessions.filter(
    (s) => new Date(s.startedAt).getTime() >= sevenDaysAgo,
  );

  const inactiveCount = olimpoStudents.filter((s) => {
    if (!s.isActive) return true;
    const d = daysSince(s.lastLoginAt);
    return d === null || d > 14;
  }).length;

  const upcomingSessions = Math.max(
    Math.round(activeStudentsCount * 0.6),
    activeStudentsCount > 0 ? 1 : 0,
  );

  const cards: OverviewCard[] = [
    {
      code: '01',
      label: 'Alumnos activos',
      value: activeStudentsCount,
      subtitle: `de ${olimpoStudents.length} en total`,
      emphasis: true,
    },
    {
      code: '02',
      label: 'Sesiones · 7 días',
      value: sessionsThisWeek.length,
      subtitle: 'iniciadas en la última semana',
    },
    {
      code: '03',
      label: 'Pendientes',
      value: upcomingSessions,
      subtitle: 'rutinas asignadas sin completar',
    },
    {
      code: '04',
      label: 'Sin actividad',
      value: inactiveCount,
      subtitle: 'alumnos sin ingresar hace 14+ días',
    },
  ];

  const recent: MockSession[] = [...mockSessions]
    .sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    )
    .slice(0, 5);

  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="px-5 lg:px-8 py-8 lg:py-10">
      <div className="mx-auto max-w-6xl">
        {/* Page header */}
        <header className="mb-10 lg:mb-12 flex flex-col gap-2 border-b border-border pb-8">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            <span>Panel</span>
            <span aria-hidden>/</span>
            <span className="text-brand-primary">Dashboard</span>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl lg:text-[40px] font-semibold tracking-tight leading-[1.05]">
                Buen día, {tenant.name}.
              </h1>
              <p className="mt-2 text-[15px] text-muted-foreground max-w-xl">
                Resumen rápido de tu gimnasio. Datos de demostración.
              </p>
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              {today}
            </p>
          </div>
        </header>

        {/* Overview cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px bg-border border border-border rounded-xl overflow-hidden">
          {cards.map((card) => (
            <article
              key={card.code}
              className="relative bg-background p-6 lg:p-7 flex flex-col gap-5 min-h-[170px]"
            >
              <header className="flex items-center justify-between text-muted-foreground">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em]">
                  {card.label}
                </span>
                <span className="font-mono text-[10px] tracking-widest">
                  {card.code}
                </span>
              </header>
              <div className="flex items-baseline gap-3">
                <span
                  className="text-5xl lg:text-6xl font-semibold tracking-tight leading-none tabular-nums"
                  style={card.emphasis ? { color: 'var(--brand-primary)' } : {}}
                >
                  {card.value.toString().padStart(2, '0')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                {card.subtitle}
              </p>
            </article>
          ))}
        </section>

        {/* Recent activity */}
        <section className="mt-12 lg:mt-16">
          <header className="mb-5 flex items-end justify-between">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Bitácora
              </span>
              <h2 className="mt-1 text-xl lg:text-2xl font-semibold tracking-tight">
                Actividad reciente
              </h2>
            </div>
            <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              últimas {recent.length}
            </span>
          </header>

          <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-background">
            {recent.length === 0 ? (
              <li className="p-6 text-sm text-muted-foreground">
                Sin actividad todavía.
              </li>
            ) : (
              recent.map((session, i) => {
                const student = getStudentById(session.studentId);
                const routine = getRoutineById(session.routineId);
                const studentName = student
                  ? `${student.firstName} ${student.lastName}`
                  : 'Alumno';
                const initials = student
                  ? `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase()
                  : '··';
                const isCompleted = Boolean(session.completedAt);

                return (
                  <li
                    key={session.id}
                    className="flex items-center gap-4 px-5 lg:px-6 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-6 shrink-0">
                      {(i + 1).toString().padStart(2, '0')}
                    </span>
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-semibold text-brand-primary">
                      {initials}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {studentName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {routine?.name ?? 'Rutina'}
                      </p>
                    </div>
                    <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {formatRelative(session.startedAt)}
                    </span>
                    <span
                      className={
                        isCompleted
                          ? 'inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300'
                          : 'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em]'
                      }
                      style={
                        isCompleted
                          ? {}
                          : {
                              borderColor: 'var(--brand-primary)',
                              color: 'var(--brand-primary)',
                            }
                      }
                    >
                      <span
                        className="h-1 w-1 rounded-full"
                        style={{
                          background: isCompleted
                            ? 'rgb(110 231 183)'
                            : 'var(--brand-primary)',
                        }}
                      />
                      {isCompleted ? 'Completa' : 'En curso'}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
