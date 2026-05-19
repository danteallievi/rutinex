/**
 * Cursor opaco para `GET /sessions` (ADR-026 §8). Codifica el último
 * `(startedAt, id)` de la página actual; el server decodifica para armar
 * el `WHERE (started_at, id) < (?, ?)`. Es opaco para el cliente —
 * cambia el shape sin breaking change.
 *
 * Implementación: JSON minificado → base64url (sin padding). Útil para
 * debug en logs sin exponer el formato.
 */
export interface SessionsCursor {
  startedAt: string;
  id: string;
}

export function encodeCursor(cursor: SessionsCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf-8').toString('base64url');
}

export function decodeCursor(raw: string): SessionsCursor | null {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as { startedAt?: unknown }).startedAt === 'string' &&
      typeof (parsed as { id?: unknown }).id === 'string'
    ) {
      return parsed as SessionsCursor;
    }
    return null;
  } catch {
    return null;
  }
}
