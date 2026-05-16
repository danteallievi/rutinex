import { Logger } from '@nestjs/common';

import dataSource from '../data-source';
import { Tenant } from '../modules/tenants/entities/tenant.entity';

/**
 * Smoke check del Step 3: abre la conexión, cuenta filas en `tenants`
 * y exige que la tabla exista y esté vacía. Útil tras `migration:run`.
 */
async function smokeTenants(): Promise<void> {
  const logger = new Logger('smoke-tenants');

  await dataSource.initialize();
  try {
    const count = await dataSource.getRepository(Tenant).count();
    if (count !== 0) {
      throw new Error(
        `Esperaba la tabla "tenants" vacía, encontré ${count} fila(s).`,
      );
    }
    logger.log('OK — tabla "tenants" existe y está vacía (0 filas).');
  } finally {
    await dataSource.destroy();
  }
}

smokeTenants().catch((err: unknown) => {
  const message =
    err instanceof Error ? (err.stack ?? err.message) : String(err);
  new Logger('smoke-tenants').error(`Smoke falló: ${message}`);
  process.exit(1);
});
