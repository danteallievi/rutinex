import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getExerciseById,
  mockRoutines,
  olimpoTenant,
  type MockRoutineItem,
} from '@/lib/mock-data';

interface ExerciseDetailProps {
  params: Promise<{ slug: string; id: string }>;
}

function findItemForExercise(exerciseId: string): MockRoutineItem | undefined {
  for (const routine of mockRoutines) {
    const found = routine.items.find((it) => it.exerciseId === exerciseId);
    if (found) return found;
  }
  return undefined;
}

export default async function ExerciseDetail({ params }: ExerciseDetailProps) {
  const { slug, id } = await params;
  const exercise = getExerciseById(id);
  if (!exercise) {
    notFound();
  }

  const tenant = olimpoTenant;
  const primary = tenant.branding.primaryColor;
  const item = findItemForExercise(exercise.id);

  const setCount = item?.prescribedSets ?? 4;
  const targetReps = item?.prescribedReps ?? '8-10';
  const targetWeight = item?.prescribedWeight ?? '';
  const restSeconds = item?.restSeconds ?? 90;

  const sets = Array.from({ length: setCount }, (_, i) => i + 1);

  // Default plausible para que la tabla parezca llena.
  const defaultRepsNum =
    Number.parseInt(targetReps.match(/\d+/)?.[0] ?? '10', 10) || 10;
  const defaultWeightNum = Number.parseInt(
    targetWeight.match(/\d+/)?.[0] ?? '',
    10,
  );

  const basePath = `/t/${slug}`;

  return (
    <div className="flex flex-col gap-7">
      {/* Back link */}
      <Link
        href={`${basePath}/student`}
        className="inline-flex items-center gap-2 self-start font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Volver a hoy
      </Link>

      {/* HERO */}
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            Ejercicio
          </span>
          <h1 className="text-3xl font-black leading-[1.02] tracking-tight sm:text-4xl">
            {exercise.title}
          </h1>
          <ul className="flex flex-wrap gap-2">
            {exercise.muscleGroups.map((m) => (
              <li
                key={m}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em]"
                style={{
                  borderColor: `color-mix(in srgb, ${primary} 45%, transparent)`,
                  color: primary,
                }}
              >
                <span
                  className="inline-block h-1 w-1 rounded-full"
                  style={{ background: primary }}
                  aria-hidden
                />
                {m}
              </li>
            ))}
          </ul>
        </div>

        {/* Video placeholder */}
        <div
          className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${primary} 24%, oklch(0.18 0 0)) 0%, oklch(0.10 0 0) 60%, oklch(0.06 0 0) 100%)`,
          }}
        >
          {/* Faint mesh */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.10]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, white 0 1px, transparent 1px 24px), repeating-linear-gradient(90deg, white 0 1px, transparent 1px 24px)',
            }}
          />
          {/* Brand glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full opacity-50 blur-3xl"
            style={{ background: primary }}
          />

          {/* Top label */}
          <div className="absolute left-4 top-4 flex items-center gap-2">
            <span
              className="inline-flex h-2 w-2 animate-pulse rounded-full"
              style={{ background: primary }}
              aria-hidden
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/80">
              Video del ejercicio
            </span>
          </div>

          {/* Bottom meta */}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between text-white/85">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
                Demo técnica
              </p>
              <p className="mt-1 text-sm font-semibold leading-tight">
                {exercise.title}
              </p>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
              {exercise.mediaType}
            </span>
          </div>

          {/* Play button (centered) */}
          <button
            type="button"
            aria-label="Reproducir demo"
            className="absolute left-1/2 top-1/2 inline-flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-black shadow-[0_20px_40px_-12px_rgba(0,0,0,0.7)] transition-transform hover:scale-105 active:scale-95"
            style={{ background: primary }}
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="currentColor"
              aria-hidden
            >
              <path d="M8 5.5v13a.5.5 0 0 0 .77.42l10-6.5a.5.5 0 0 0 0-.84l-10-6.5A.5.5 0 0 0 8 5.5Z" />
            </svg>
          </button>
        </div>
      </section>

      {/* Descripción */}
      {exercise.description ? (
        <section aria-labelledby="desc-title" className="flex flex-col gap-2">
          <h2
            id="desc-title"
            className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground"
          >
            Cómo hacerlo
          </h2>
          <p className="text-base leading-[1.7] text-foreground/85">
            {exercise.description}
          </p>
        </section>
      ) : null}

      {/* Prescripción */}
      <section className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
        <div className="flex flex-col gap-1 bg-background px-4 py-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            Prescripción
          </span>
          <span className="text-xl font-bold tabular-nums">
            {setCount}×{targetReps}
          </span>
        </div>
        <div className="flex flex-col gap-1 bg-background px-4 py-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            Peso
          </span>
          <span className="text-xl font-bold leading-snug">
            {targetWeight || '—'}
          </span>
        </div>
        <div className="flex flex-col gap-1 bg-background px-4 py-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            Descanso
          </span>
          <span className="text-xl font-bold tabular-nums">
            {restSeconds}
            <span className="ml-1 text-sm font-medium text-muted-foreground">
              s
            </span>
          </span>
        </div>
      </section>

      {/* Tabla de sets */}
      <section aria-labelledby="sets-title" className="flex flex-col gap-3">
        <div className="flex items-end justify-between">
          <h2 id="sets-title" className="text-xl font-bold tracking-tight">
            Registrá tus sets
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {setCount} sets
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          {/* Header */}
          <div className="grid grid-cols-[56px_1fr_1fr_56px] items-center gap-3 border-b border-border bg-muted/40 px-3 py-2.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Set
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Reps
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Peso (kg)
            </span>
            <span className="text-right font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
              Listo
            </span>
          </div>
          <ul className="divide-y divide-border">
            {sets.map((n) => (
              <li
                key={n}
                className="grid grid-cols-[56px_1fr_1fr_56px] items-center gap-3 px-3 py-3"
              >
                <span className="font-mono text-lg font-bold tabular-nums">
                  {n.toString().padStart(2, '0')}
                </span>
                <label className="flex flex-col gap-1">
                  <span className="sr-only">Reps set {n}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={50}
                    defaultValue={defaultRepsNum}
                    placeholder={targetReps}
                    aria-label={`Reps del set ${n}`}
                    className="h-11 w-full rounded-md border border-border bg-background px-3 text-base font-semibold tabular-nums outline-none transition-colors focus:border-foreground focus:ring-2"
                    style={
                      {
                        ['--tw-ring-color']: `color-mix(in srgb, ${primary} 35%, transparent)`,
                      } as React.CSSProperties
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="sr-only">Peso set {n}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.5}
                    defaultValue={
                      Number.isFinite(defaultWeightNum)
                        ? defaultWeightNum
                        : undefined
                    }
                    placeholder={targetWeight || 'kg'}
                    aria-label={`Peso del set ${n}`}
                    className="h-11 w-full rounded-md border border-border bg-background px-3 text-base font-semibold tabular-nums outline-none transition-colors focus:border-foreground focus:ring-2"
                    style={
                      {
                        ['--tw-ring-color']: `color-mix(in srgb, ${primary} 35%, transparent)`,
                      } as React.CSSProperties
                    }
                  />
                </label>
                <div className="flex justify-end">
                  <label className="relative inline-flex h-11 w-11 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      aria-label={`Marcar set ${n} como listo`}
                      defaultChecked={n === 1}
                    />
                    <span
                      aria-hidden
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-transparent transition-colors peer-checked:border-transparent peer-checked:text-black peer-focus-visible:ring-2"
                      style={
                        {
                          ['--tw-ring-color']: `color-mix(in srgb, ${primary} 50%, transparent)`,
                        } as React.CSSProperties
                      }
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12l4.5 4.5L19 7" />
                      </svg>
                    </span>
                    <span
                      aria-hidden
                      className="absolute inset-0 -z-10 rounded-md transition-opacity peer-checked:z-0 peer-checked:opacity-100 opacity-0"
                      style={{ background: primary }}
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {item?.notes ? (
          <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-[12px] italic leading-relaxed text-muted-foreground">
            Nota del coach: {item.notes}
          </p>
        ) : null}
      </section>

      {/* CTA */}
      <section className="flex flex-col gap-3 pb-2">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-4 text-base font-bold uppercase tracking-[0.12em] text-black transition-transform active:scale-[0.98]"
          style={{ background: primary }}
        >
          Guardar y volver
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] text-foreground/80 transition-colors hover:bg-muted/60"
        >
          Saltar este ejercicio
        </button>
      </section>
    </div>
  );
}
