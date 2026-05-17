import Link from 'next/link';
import {
  getExerciseById,
  mockRoutines,
  olimpoStudents,
  olimpoTenant,
  type MockRoutine,
  type MockRoutineItem,
  type MockUser,
} from '@/lib/mock-data';

interface StudentHomeProps {
  params: Promise<{ slug: string }>;
}

const DAY_NAMES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];
const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function formatToday(): { dayLabel: string; longLabel: string } {
  const now = new Date();
  const dayName = DAY_NAMES[now.getDay()] ?? 'hoy';
  const month = MONTH_NAMES[now.getMonth()] ?? '';
  const dayNum = now.getDate();
  return {
    dayLabel: dayName,
    longLabel: `Hoy, ${dayName} ${dayNum} de ${month}`,
  };
}

function estimateMinutes(items: MockRoutineItem[]): number {
  // Estimación visual: ~30s por rep + descanso del item.
  const total = items.reduce((acc, it) => {
    const reps = Number.parseInt(
      it.prescribedReps.match(/\d+/)?.[0] ?? '10',
      10,
    );
    const work = it.prescribedSets * Math.max(20, reps * 3);
    const rest = (it.restSeconds ?? 60) * (it.prescribedSets - 1);
    return acc + work + rest;
  }, 0);
  return Math.max(20, Math.round(total / 60));
}

function uniqueMuscleSummary(items: MockRoutineItem[]): string {
  const seen = new Set<string>();
  for (const item of items) {
    const ex = getExerciseById(item.exerciseId);
    if (!ex) continue;
    for (const m of ex.muscleGroups) seen.add(m);
  }
  return Array.from(seen).slice(0, 3).join(' · ');
}

export default async function StudentHome({ params }: StudentHomeProps) {
  const { slug } = await params;

  const student: MockUser =
    olimpoStudents.find((u) => u.id === 'u-student-1') ?? olimpoStudents[0]!;
  const routine: MockRoutine = mockRoutines[0]!;
  const tenant = olimpoTenant;
  const primary = tenant.branding.primaryColor;

  const today = formatToday();
  const estMinutes = estimateMinutes(routine.items);
  const muscleSummary = uniqueMuscleSummary(routine.items);
  const sortedItems = [...routine.items].sort(
    (a, b) => a.position - b.position,
  );

  const basePath = `/t/${slug}`;

  const upcoming = [
    {
      when: 'Mañana',
      title: 'Tren inferior',
      detail: 'Cuádriceps · isquios · glúteos',
      tag: 'Fuerza',
    },
    {
      when: 'Domingo',
      title: 'Cardio + core',
      detail: 'Intervalos · abdomen profundo',
      tag: 'Resistencia',
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* HERO */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: primary }}
            aria-hidden
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            {today.longLabel}
          </span>
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-[0.95] sm:text-5xl">
            Hola,
            <br />
            <span className="text-foreground">
              {student.firstName}
              <span style={{ color: primary }}>.</span>
            </span>
          </h1>
          <p className="mt-3 max-w-md text-base text-muted-foreground sm:text-lg">
            Tu sesión te espera. Vamos por la de hoy.
          </p>
        </div>

        {/* Stat strip */}
        <dl className="mt-1 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
          <div className="flex flex-col gap-1 bg-background px-4 py-3">
            <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Ejercicios
            </dt>
            <dd className="text-2xl font-bold tabular-nums">
              {sortedItems.length}
            </dd>
          </div>
          <div className="flex flex-col gap-1 bg-background px-4 py-3">
            <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Duración
            </dt>
            <dd className="text-2xl font-bold tabular-nums">
              {estMinutes}
              <span className="ml-1 text-sm font-medium text-muted-foreground">
                min
              </span>
            </dd>
          </div>
          <div className="flex flex-col gap-1 bg-background px-4 py-3">
            <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Foco
            </dt>
            <dd className="truncate text-sm font-semibold leading-tight pt-1.5">
              {muscleSummary || 'Mixto'}
            </dd>
          </div>
        </dl>
      </section>

      {/* SESIÓN DE HOY — la estrella */}
      <section
        aria-labelledby="session-title"
        className="relative overflow-hidden rounded-2xl bg-foreground text-background shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)]"
      >
        {/* Brand corner glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-30 blur-3xl"
          style={{ background: primary }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 80px)',
          }}
        />

        <div className="relative px-5 pb-5 pt-6 sm:px-7 sm:pt-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-background/60">
                Sesión de hoy
              </span>
              <h2
                id="session-title"
                className="mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-3xl"
              >
                {routine.name}
              </h2>
              {routine.description ? (
                <p className="mt-2 max-w-md text-sm leading-relaxed text-background/70">
                  {routine.description}
                </p>
              ) : null}
            </div>
            <span
              className="shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-black"
              style={{ background: primary }}
            >
              {today.dayLabel}
            </span>
          </div>
        </div>

        {/* Items */}
        <ol className="relative divide-y divide-background/10 border-y border-background/10">
          {sortedItems.map((item, idx) => {
            const exercise = getExerciseById(item.exerciseId);
            const display = idx + 1;
            const padded = display.toString().padStart(2, '0');
            return (
              <li key={item.id}>
                <Link
                  href={`${basePath}/student/exercises/${item.exerciseId}`}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-background/5 active:bg-background/10 sm:px-7"
                >
                  {/* Number + check */}
                  <div className="flex shrink-0 flex-col items-center gap-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-background/40">
                      Set
                    </span>
                    <span className="font-mono text-xl font-bold tabular-nums leading-none">
                      {padded}
                    </span>
                  </div>

                  <span
                    aria-hidden
                    className="h-12 w-px shrink-0 bg-background/15"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold leading-tight">
                      {exercise?.title ?? 'Ejercicio'}
                    </p>
                    <p className="mt-1 text-[13px] leading-snug text-background/70">
                      <span className="tabular-nums font-medium text-background">
                        {item.prescribedSets}
                      </span>{' '}
                      sets ·{' '}
                      <span className="tabular-nums font-medium text-background">
                        {item.prescribedReps}
                      </span>{' '}
                      reps ·{' '}
                      <span className="font-medium text-background">
                        {item.prescribedWeight ?? 'según sientas'}
                      </span>
                    </p>
                    {item.notes ? (
                      <p className="mt-1 truncate text-[11px] italic text-background/55">
                        {item.notes}
                      </p>
                    ) : null}
                  </div>

                  {/* Check circle (visual only) */}
                  <span
                    aria-hidden
                    className="ml-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-background/25 text-background/40 transition-colors group-hover:border-background/60 group-hover:text-background"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>

        {/* CTA */}
        <div className="relative px-5 py-5 sm:px-7">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-3 rounded-xl px-5 py-4 text-base font-bold uppercase tracking-[0.12em] text-black transition-transform active:scale-[0.98]"
            style={{ background: primary }}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 4v16M19 4v16M5 8h14M5 16h14" />
            </svg>
            Completar sesión
          </button>
          <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-background/45">
            Tocá un ejercicio para ver detalle
          </p>
        </div>
      </section>

      {/* PRÓXIMAS SESIONES */}
      <section aria-labelledby="upcoming-title" className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <h2 id="upcoming-title" className="text-xl font-bold tracking-tight">
            Próximas sesiones
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Esta semana
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {upcoming.map((u) => (
            <article
              key={u.when}
              className="group relative flex flex-col gap-3 rounded-xl border border-border bg-background p-4 transition-colors hover:border-foreground/30"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {u.when}
                </span>
                <span
                  className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]"
                  style={{
                    borderColor: `color-mix(in srgb, ${primary} 40%, transparent)`,
                    color: primary,
                  }}
                >
                  {u.tag}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold leading-tight tracking-tight">
                  {u.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{u.detail}</p>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
                <span className="text-[11px] text-muted-foreground">
                  Programado por tu coach
                </span>
                <span
                  aria-hidden
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors group-hover:text-foreground"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Quote / motivacional sutil */}
      <section className="relative overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 px-5 py-5">
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          Recordá
        </span>
        <p className="mt-2 text-sm leading-relaxed text-foreground/80">
          La intensidad no se negocia con el reloj. Si una serie te salió floja,
          no la subas en peso — recuperate, respirá y volvé.
        </p>
      </section>
    </div>
  );
}
