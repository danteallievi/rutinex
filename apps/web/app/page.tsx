import Link from 'next/link';
import { env } from '@/lib/env';

const whatsappHref = `https://wa.me/${env.contactWhatsapp}`;

const benefits = [
  {
    code: '01',
    title: 'Subdominio propio',
    body: 'tu-gym.rutinex.app desde el día uno. Los alumnos entran a tu marca, no a la nuestra.',
  },
  {
    code: '02',
    title: 'Branding personalizado',
    body: 'Color primario, logo y nombre del estudio. Lo configuramos nosotros antes de prenderte la cuenta.',
  },
  {
    code: '03',
    title: 'Acceso por DNI',
    body: 'Los alumnos no instalan nada, no se registran, no recuperan contraseñas. Tipean su DNI y entrenan.',
  },
  {
    code: '04',
    title: 'Tracking de PRs',
    body: 'Sets, reps y kilos por sesión. Récords personales calculados automáticamente y visibles para el entrenador.',
  },
];

const pricingTiers = [
  {
    name: 'Solo',
    pitch: 'Personal trainer independiente',
    price: 'USD 19',
    cadence: '/mes',
    seats: 'Hasta 25 alumnos',
    features: [
      'Tu subdominio + branding',
      'Vos como único entrenador',
      'Rutinas y tracking ilimitados',
      'Soporte por WhatsApp',
    ],
    highlight: false,
  },
  {
    name: 'Equipo',
    pitch: 'Estudios y boxes chicos',
    price: 'USD 49',
    cadence: '/mes',
    seats: 'Hasta 100 alumnos · 5 entrenadores',
    features: [
      'Todo lo de Solo',
      'Multi-entrenador con asignación',
      'Dashboard del owner',
      'Onboarding asistido',
    ],
    highlight: true,
  },
  {
    name: 'Red',
    pitch: 'Gimnasios y cadenas',
    price: 'A medida',
    cadence: '',
    seats: 'Alumnos y entrenadores sin tope',
    features: [
      'Todo lo de Equipo',
      'Importación masiva de alumnos',
      'Branding extendido',
      'SLA y soporte prioritario',
    ],
    highlight: false,
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground antialiased">
      {/* Backdrop atmosférico — grano + halo radial. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.65) 1px, transparent 1px)',
            backgroundSize: '3px 3px',
          }}
        />
        <div
          className="absolute -top-40 left-1/2 h-[640px] w-[640px] -translate-x-1/2 rounded-full blur-3xl opacity-30"
          style={{
            background:
              'radial-gradient(circle, rgba(249,115,22,0.55), transparent 60%)',
          }}
        />
      </div>

      {/* Nav */}
      <header className="border-b border-border/70">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="relative inline-flex h-3 w-3 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-brand-primary" />
              <span className="absolute inset-0 animate-ping rounded-full bg-brand-primary opacity-60" />
            </span>
            <span className="text-base font-semibold tracking-tight">
              Rutinex
            </span>
            <span className="ml-1 hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
              SaaS para gimnasios
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <a
              href="#beneficios"
              className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Beneficios
            </a>
            <a
              href="#planes"
              className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Planes
            </a>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-brand-primary/40 bg-brand-primary/10 px-3.5 py-1.5 text-[13px] font-medium text-brand-primary transition-colors hover:bg-brand-primary/20"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              Hablar con ventas
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative border-b border-border/70">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-12 gap-y-12 px-6 py-20 lg:gap-x-10 lg:px-10 lg:py-32">
          {/* Sidebar de meta — etiquetas tipo magazine. */}
          <aside className="col-span-12 flex flex-col gap-6 lg:col-span-3 lg:border-r lg:border-border/60 lg:pr-8">
            <Meta label="VOL" value="01" />
            <Meta label="EDICIÓN" value="2026 · BA" />
            <Meta label="ESTADO" value="Operando" />
            <div className="hidden h-px w-full bg-border/60 lg:block" />
            <p className="hidden max-w-[20ch] font-mono text-[11px] uppercase leading-relaxed tracking-[0.14em] text-muted-foreground lg:block">
              Para gimnasios, boxes y personal trainers que cobran por resultado
              — no por descargas.
            </p>
          </aside>

          {/* Headline */}
          <div className="col-span-12 lg:col-span-9">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/30 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              Te damos de alta nosotros · sin tarjeta
            </span>
            <h1 className="mt-6 font-semibold tracking-[-0.03em] text-foreground">
              <span className="block text-[clamp(2.75rem,8vw,6.5rem)] leading-[0.92]">
                Tu gimnasio,
              </span>
              <span className="block text-[clamp(2.75rem,8vw,6.5rem)] leading-[0.92]">
                tu marca,
              </span>
              <span className="block text-[clamp(2.75rem,8vw,6.5rem)] leading-[0.92] text-brand-primary">
                tu plataforma.
              </span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground lg:text-xl">
              Rutinex es la base operativa para entrenadores que se cansaron de
              Excel, WhatsApp y apps genéricas. Cada gimnasio recibe{' '}
              <strong className="font-medium text-foreground">
                su propio subdominio
              </strong>
              , con{' '}
              <strong className="font-medium text-foreground">
                su branding
              </strong>{' '}
              y{' '}
              <strong className="font-medium text-foreground">
                acceso por DNI
              </strong>{' '}
              para los alumnos.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-center gap-3 rounded-full bg-brand-primary px-6 py-3.5 text-sm font-semibold tracking-tight text-black shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_30px_60px_-20px_rgba(249,115,22,0.6)] transition-transform hover:-translate-y-0.5"
              >
                Hablar por WhatsApp
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] opacity-70 transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </a>
              <a
                href="#planes"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background/40 px-6 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Ver planes
              </a>
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground sm:ml-2">
                Onboarding humano · alta en 24h
              </span>
            </div>

            {/* Strip de pruebas — tags simples como subline. */}
            <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4 lg:max-w-3xl">
              <Stat n="14" label="alumnos activos en demo" />
              <Stat n="3" label="entrenadores asignables" />
              <Stat n="12" label="ejercicios prearmados" />
              <Stat n="4" label="rutinas de ejemplo" />
            </div>
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section id="beneficios" className="relative border-b border-border/70">
        <div className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
          <div className="flex items-end justify-between gap-6">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand-primary">
                / 02 — qué incluye
              </span>
              <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight lg:text-5xl">
                Diseñado para sales-led,
                <br />
                no para signup público.
              </h2>
            </div>
            <p className="hidden max-w-sm text-sm leading-relaxed text-muted-foreground lg:block">
              No tenés que armar nada vos: te damos de alta, configuramos tu
              branding y subdominio, y dejamos al primer owner listo para
              entrar.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2">
            {benefits.map((b) => (
              <article
                key={b.code}
                className="group relative flex flex-col gap-4 bg-background/95 p-8 transition-colors hover:bg-muted/40 lg:p-10"
              >
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    / {b.code}
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-primary opacity-60 transition-opacity group-hover:opacity-100" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight lg:text-2xl">
                  {b.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {b.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="relative border-b border-border/70">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-12 gap-y-10 px-6 py-24 lg:gap-x-10 lg:px-10">
          <div className="col-span-12 lg:col-span-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand-primary">
              / 03 — cómo funciona
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight lg:text-5xl">
              Tres pasos.
              <br />
              Cero fricción.
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
              No hay formularios eternos ni tarjetas de crédito. Coordinás con
              nosotros, te damos de alta, y al toque tu equipo está trabajando.
            </p>
          </div>

          <ol className="col-span-12 flex flex-col gap-4 lg:col-span-8">
            <Step
              n="01"
              title="Conversamos"
              body="Te conectamos por WhatsApp para entender el tamaño del estudio, cuántos entrenadores y qué branding querés."
            />
            <Step
              n="02"
              title="Te damos de alta"
              body="Creamos tu tenant con tu subdominio (tu-gym.rutinex.app), aplicamos tu color primario y dejamos al owner listo para loguear."
            />
            <Step
              n="03"
              title="Cargás alumnos y rutinas"
              body="Los entrenadores arman las rutinas. Los alumnos entran con su DNI desde el subdominio y empiezan a trackear sus PRs."
            />
          </ol>
        </div>
      </section>

      {/* Planes */}
      <section id="planes" className="relative border-b border-border/70">
        <div className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand-primary">
                / 04 — planes
              </span>
              <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight lg:text-5xl">
                Pago mensual, sin tarjeta.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Te damos de alta nosotros — sin tarjeta, sin trámites. Coordinás
                el alta y el cobro por WhatsApp.
              </p>
            </div>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              Pedinos asesoría
            </a>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
            {pricingTiers.map((tier) => (
              <article
                key={tier.name}
                className={
                  tier.highlight
                    ? 'relative flex flex-col rounded-2xl border border-brand-primary/40 bg-gradient-to-b from-brand-primary/[0.08] to-background p-8 shadow-[0_30px_80px_-40px_rgba(249,115,22,0.45)]'
                    : 'relative flex flex-col rounded-2xl border border-border bg-background/40 p-8'
                }
              >
                {tier.highlight ? (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-black">
                    Recomendado
                  </span>
                ) : null}
                <div className="flex items-baseline justify-between">
                  <h3 className="text-2xl font-semibold tracking-tight">
                    {tier.name}
                  </h3>
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {tier.pitch}
                  </span>
                </div>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight">
                    {tier.price}
                  </span>
                  {tier.cadence ? (
                    <span className="text-sm text-muted-foreground">
                      {tier.cadence}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {tier.seats}
                </p>
                <ul className="mt-6 flex flex-1 flex-col gap-3 border-t border-border/60 pt-6 text-sm">
                  {tier.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-3 text-foreground/85"
                    >
                      <span className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={
                    tier.highlight
                      ? 'mt-8 inline-flex items-center justify-center rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-black transition-transform hover:-translate-y-0.5'
                      : 'mt-8 inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted'
                  }
                >
                  Contactanos por WhatsApp
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative border-b border-border/70">
        <div className="mx-auto w-full max-w-7xl px-6 py-24 lg:px-10">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-muted/30 p-10 lg:p-16">
            <div
              aria-hidden
              className="absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full blur-3xl opacity-50"
              style={{
                background:
                  'radial-gradient(circle, rgba(249,115,22,0.45), transparent 65%)',
              }}
            />
            <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand-primary">
                  / 05 — siguiente paso
                </span>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight lg:text-5xl">
                  Coordinemos tu alta esta semana.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground lg:text-lg">
                  Sin tarjeta, sin tramites. Te damos de alta nosotros y al
                  toque podés invitar a tu equipo.
                </p>
              </div>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 rounded-full bg-brand-primary px-7 py-4 text-base font-semibold text-black shadow-[0_30px_60px_-20px_rgba(249,115,22,0.6)] transition-transform hover:-translate-y-0.5"
              >
                Escribirnos por WhatsApp
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] opacity-70">
                  →
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-6 py-10 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-brand-primary" />
            <span className="font-medium text-foreground">Rutinex</span>
            <span className="font-mono uppercase tracking-[0.16em]">
              · {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              WhatsApp
            </a>
            <a
              href="#beneficios"
              className="transition-colors hover:text-foreground"
            >
              Beneficios
            </a>
            <a
              href="#planes"
              className="transition-colors hover:text-foreground"
            >
              Planes
            </a>
            <span className="font-mono tracking-[0.14em]">
              Buenos Aires · AR
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-sm text-foreground">{value}</span>
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border/60 pt-4">
      <span className="text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
        {n}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="group flex items-start gap-6 rounded-2xl border border-border bg-background/40 p-6 transition-colors hover:border-brand-primary/40 hover:bg-muted/30 lg:p-7">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand-primary">
        / {n}
      </span>
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold tracking-tight lg:text-xl">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}
