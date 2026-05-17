import { env } from '@/lib/env';

export default function TenantNotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center flex flex-col items-center gap-4">
        <span className="text-xs font-mono text-muted-foreground tracking-widest">
          404 · TENANT NOT FOUND
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">
          Este gimnasio no existe
        </h1>
        <p className="text-muted-foreground">
          El subdominio al que entraste no corresponde a ningún tenant activo.
          Si es tuyo, fijate que el slug esté bien escrito o que la cuenta esté
          activa.
        </p>
        <a
          href={`http://${env.rootHost}`}
          className="mt-4 inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          Volver a rutinex
        </a>
      </div>
    </main>
  );
}
