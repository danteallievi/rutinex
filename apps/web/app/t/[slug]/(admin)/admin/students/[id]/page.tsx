import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getExerciseById,
  getStudentById,
  mockRoutines,
  olimpoTrainers,
  type MockRoutineItem,
} from '@/lib/mock-data';

function formatLong(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

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

export default async function StudentDetailPage(props: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { id } = await props.params;

  const student = getStudentById(id);
  if (!student) {
    notFound();
  }

  const trainer = student.trainerId
    ? olimpoTrainers.find((t) => t.id === student.trainerId)
    : null;

  const initials =
    `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
  const fullName = `${student.firstName} ${student.lastName}`;

  const routine = mockRoutines[0];
  const items: MockRoutineItem[] = routine
    ? routine.items.slice(0, 5).sort((a, b) => a.position - b.position)
    : [];

  return (
    <div className="px-5 lg:px-8 py-8 lg:py-10">
      <div className="mx-auto max-w-6xl">
        {/* Breadcrumb / back */}
        <Link
          href="/admin/students"
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground hover:text-foreground transition-colors"
        >
          <span aria-hidden>←</span>
          Alumnos
        </Link>

        {/* Header */}
        <header className="mt-5 mb-10 border-b border-border pb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-5">
              <span
                className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-black shadow-lg"
                style={{ background: 'var(--brand-primary)' }}
              >
                {initials}
              </span>
              <div className="leading-tight">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-1.5">
                  Alumno · {student.id.slice(0, 8)}
                </p>
                <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight">
                  {fullName}
                </h1>
                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    DNI {student.dni}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  {student.isActive ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300">
                      <span className="h-1 w-1 rounded-full bg-emerald-300" />
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                      <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                      Inactivo
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-end">
              <button
                type="button"
                className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
              >
                Asignar rutina
              </button>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
              >
                Editar
              </button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-10">
          {/* Main column */}
          <div>
            {/* Tabs (visual only) */}
            <div
              role="tablist"
              aria-label="Vistas del alumno"
              className="flex items-center gap-1 border-b border-border overflow-x-auto"
            >
              {[
                { key: 'routines', label: 'Rutinas' },
                { key: 'history', label: 'Histórico' },
                { key: 'prs', label: 'PRs' },
                { key: 'comments', label: 'Comentarios' },
              ].map((tab, i) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={i === 0}
                  className={
                    i === 0
                      ? 'relative px-4 py-3 text-sm font-medium text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:bg-brand-primary'
                      : 'px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors'
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content: routines */}
            <section className="mt-7">
              {routine ? (
                <article className="overflow-hidden rounded-xl border border-border bg-background">
                  {/* Routine head */}
                  <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-border px-6 py-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                          Rutina asignada
                        </span>
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em]"
                          style={{
                            color: 'var(--brand-primary)',
                            border:
                              '1px solid color-mix(in srgb, var(--brand-primary) 40%, transparent)',
                            background:
                              'color-mix(in srgb, var(--brand-primary) 10%, transparent)',
                          }}
                        >
                          <span
                            className="h-1 w-1 rounded-full"
                            style={{ background: 'var(--brand-primary)' }}
                          />
                          Vigente
                        </span>
                      </div>
                      <h2 className="mt-2 text-xl font-semibold tracking-tight">
                        {routine.name}
                      </h2>
                      {routine.description ? (
                        <p className="mt-1 text-sm text-muted-foreground max-w-prose">
                          {routine.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                        Desde
                      </span>
                      <span className="text-sm">1 de mayo</span>
                      <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                        {routine.items.length} ejercicios
                      </span>
                    </div>
                  </header>

                  {/* Items */}
                  <ol className="divide-y divide-border">
                    {items.map((item, i) => {
                      const exercise = getExerciseById(item.exerciseId);
                      return (
                        <li
                          key={item.id}
                          className="px-6 py-5 hover:bg-muted/20 transition-colors"
                        >
                          <div className="flex items-start gap-4">
                            <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-6 shrink-0 pt-1">
                              {(i + 1).toString().padStart(2, '0')}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                <h3 className="text-[15px] font-medium tracking-tight">
                                  {exercise?.title ?? 'Ejercicio'}
                                </h3>
                                {exercise &&
                                exercise.muscleGroups.length > 0 ? (
                                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                    {exercise.muscleGroups
                                      .slice(0, 2)
                                      .join(' · ')}
                                  </span>
                                ) : null}
                              </div>
                              {item.notes ? (
                                <p className="mt-1.5 text-xs text-muted-foreground italic">
                                  {item.notes}
                                </p>
                              ) : null}
                              <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <Spec
                                  label="Series x reps"
                                  value={
                                    <span className="tabular-nums">
                                      {item.prescribedSets}
                                      <span className="text-muted-foreground mx-1">
                                        ×
                                      </span>
                                      {item.prescribedReps}
                                    </span>
                                  }
                                  emphasis
                                />
                                <Spec
                                  label="Peso"
                                  value={item.prescribedWeight ?? '—'}
                                />
                                <Spec
                                  label="Descanso"
                                  value={
                                    item.restSeconds !== null
                                      ? `${item.restSeconds}s`
                                      : '—'
                                  }
                                />
                                <Spec
                                  label="Media"
                                  value={
                                    exercise?.mediaType &&
                                    exercise.mediaType !== 'none'
                                      ? exercise.mediaType
                                      : '—'
                                  }
                                />
                              </dl>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </article>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sin rutina asignada.
                </p>
              )}
            </section>

            {/* Placeholders for other tabs */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  title: 'Histórico',
                  copy: 'Sesiones pasadas, sets ejecutados y comparativos.',
                },
                {
                  title: 'PRs',
                  copy: 'Marcas personales por ejercicio y evolución.',
                },
                {
                  title: 'Comentarios',
                  copy: 'Notas internas entre trainer y alumno.',
                },
              ].map((p) => (
                <div
                  key={p.title}
                  className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-4"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {p.title}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground/80">
                    {p.copy}
                  </p>
                  <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.22em] text-brand-primary">
                    Próximamente
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Side info */}
          <aside className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-background overflow-hidden">
              <div className="border-b border-border px-5 py-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Información
                </span>
              </div>
              <dl className="px-5 py-4 grid grid-cols-1 gap-y-4 text-sm">
                <InfoRow
                  label="Email"
                  value={student.email ?? 'sin email'}
                  mono
                />
                <InfoRow
                  label="Trainer asignado"
                  value={
                    trainer
                      ? `${trainer.firstName} ${trainer.lastName}`
                      : 'sin asignar'
                  }
                />
                <InfoRow
                  label="Fecha de alta"
                  value={formatLong(student.createdAt)}
                />
                <InfoRow
                  label="Último ingreso"
                  value={formatRelative(student.lastLoginAt)}
                />
                <InfoRow
                  label="Estado"
                  value={student.isActive ? 'Activo' : 'Inactivo'}
                />
              </dl>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 px-5 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Vista mock
              </p>
              <p className="mt-2 text-xs text-muted-foreground leading-snug">
                Esta vista será reemplazada por datos reales en Steps 23-25.
                Sirve para demos comerciales y para validar la jerarquía visual
                del detalle del alumno.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 leading-tight">
      <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          mono ? 'font-mono text-xs text-foreground break-all' : 'text-sm'
        }
      >
        {value}
      </dd>
    </div>
  );
}

function Spec({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="leading-tight">
      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p
        className={
          emphasis
            ? 'mt-1 text-base font-semibold tracking-tight'
            : 'mt-1 text-sm text-foreground/90'
        }
      >
        {value}
      </p>
    </div>
  );
}
