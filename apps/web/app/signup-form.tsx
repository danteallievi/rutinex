'use client';

import { useState, type FormEvent } from 'react';
import { ApiClientError, createTenant } from '@/lib/api-client';
import { env } from '@/lib/env';

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; slug: string };

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function tenantUrl(slug: string): string {
  return `http://${slug}.${env.rootHost}`;
}

export function SignupForm() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#f97316');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const slugValid = effectiveSlug.length >= 3 && SLUG_REGEX.test(effectiveSlug);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !slugValid) return;

    setStatus({ kind: 'submitting' });
    try {
      const tenant = await createTenant({
        name: name.trim(),
        slug: effectiveSlug,
        branding: { primaryColor },
      });
      setStatus({ kind: 'success', slug: tenant.slug });
      // Redirect cross-origin al subdominio del tenant.
      window.location.assign(tenantUrl(tenant.slug));
    } catch (err) {
      if (err instanceof ApiClientError) {
        const code = err.body.code;
        if (code === 'SLUG_TAKEN') {
          setStatus({
            kind: 'error',
            message: `El slug "${effectiveSlug}" ya está tomado. Probá otro.`,
          });
          return;
        }
        if (code === 'SLUG_RESERVED') {
          setStatus({
            kind: 'error',
            message: `El slug "${effectiveSlug}" está reservado. Probá otro.`,
          });
          return;
        }
        setStatus({
          kind: 'error',
          message: Array.isArray(err.body.message)
            ? err.body.message.join(' ')
            : err.body.message,
        });
        return;
      }
      setStatus({
        kind: 'error',
        message: 'No pudimos conectar con el API. Revisá que esté corriendo.',
      });
    }
  }

  const submitting = status.kind === 'submitting';
  const success = status.kind === 'success';

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field
        label="Nombre del gimnasio"
        id="name"
        value={name}
        onChange={setName}
        placeholder="Gimnasio Olimpo"
        autoComplete="organization"
        required
      />

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="slug"
          className="text-xs font-medium text-muted-foreground"
        >
          Slug (subdominio)
        </label>
        <div className="flex items-stretch rounded-lg border border-border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-brand-primary/40">
          <input
            id="slug"
            value={effectiveSlug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            placeholder="olimpo"
            autoComplete="off"
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 font-mono"
          />
          <span className="self-center pr-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
            .{env.rootHost}
          </span>
        </div>
        <span
          className={`text-xs ${
            slugTouched && !slugValid && effectiveSlug.length > 0
              ? 'text-red-400'
              : 'text-muted-foreground'
          }`}
        >
          {slugTouched && !slugValid && effectiveSlug.length > 0
            ? 'Solo minúsculas, números y guiones. Mínimo 3 caracteres.'
            : 'Te lo armamos automático desde el nombre. Tocalo si querés cambiarlo.'}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="primaryColor"
          className="text-xs font-medium text-muted-foreground"
        >
          Color primario
        </label>
        <div className="flex items-center gap-3">
          <input
            id="primaryColor"
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-14 rounded-lg border border-border bg-background cursor-pointer"
          />
          <code className="text-sm font-mono text-muted-foreground">
            {primaryColor}
          </code>
        </div>
      </div>

      {status.kind === 'error' ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {status.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting || !slugValid || !name.trim() || success}
        className="mt-2 inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {submitting
          ? 'Creando...'
          : success
            ? `Redirigiendo a ${status.slug}...`
            : 'Crear gimnasio'}
      </button>
    </form>
  );
}

interface FieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-brand-primary/40"
      />
    </div>
  );
}
