import { SignupForm } from './signup-form';

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto w-full px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-brand-primary" />
            <span className="font-semibold tracking-tight">Rutinex</span>
          </div>
          <a
            href="#signup"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Crear mi gimnasio
          </a>
        </div>
      </header>

      <section className="flex-1 grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto w-full px-6 py-16 lg:py-24">
        <div className="flex flex-col justify-center gap-6">
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
            Multi-tenant · Subdominio propio · Branding tuyo
          </span>
          <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.05]">
            Tu gimnasio,
            <br />
            <span className="text-brand-primary">en tu dominio.</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md">
            Armá rutinas, asignalas a tus alumnos, y trackeá su progreso desde
            un panel hecho para entrenadores. Cada gimnasio en su propio
            subdominio.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono mt-2">
            <span className="text-foreground/60">tu-gym</span>
            <span className="text-foreground/40">.rutinex.app</span>
          </div>
        </div>

        <div id="signup" className="flex items-center">
          <div className="w-full rounded-2xl border border-border bg-muted/40 p-6 lg:p-8 shadow-2xl shadow-black/20">
            <h2 className="text-xl font-semibold tracking-tight">
              Creá tu gimnasio
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Sin tarjeta. Lo vas a poder ver al toque en tu subdominio.
            </p>
            <div className="mt-6">
              <SignupForm />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto w-full px-6 py-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>Rutinex · MVP</span>
          <span className="font-mono">Step 4.5 — interludio visual</span>
        </div>
      </footer>
    </main>
  );
}
