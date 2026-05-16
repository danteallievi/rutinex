import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

/**
 * Construye las opciones de conexión a Postgres a partir de env.
 * `synchronize` siempre va en `false` (ver ADR-005).
 */
export function getDataSourceOptions(): DataSourceOptions {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL no está definida. Copiá apps/api/.env.example a apps/api/.env y levantá Postgres con `pnpm db:up`.',
    );
  }

  return {
    type: 'postgres',
    url,
    entities: [join(__dirname, '..', 'modules', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
    synchronize: false,
    logging: process.env.DATABASE_LOGGING === 'true',
  };
}
