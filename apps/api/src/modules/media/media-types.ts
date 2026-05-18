import type { ExerciseMediaType } from '../exercises/entities/exercise.entity';

/**
 * Tipos de upload que el cliente puede pedir. Mapea 1:1 con los `mediaType`
 * de `exercises` excepto `none` (que no se sube — es el estado "sin media").
 */
export const MEDIA_KINDS = ['video', 'gif', 'image'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/**
 * Política por kind: límite de tamaño (Step 15 del roadmap) y mime types
 * aceptados. Cualquier cambio en estos números requiere re-evaluar el costo de
 * R2 (egress es gratis pero el storage no, ADR-004).
 */
export interface MediaPolicy {
  maxBytes: number;
  mimeTypes: readonly string[];
  /** Extensión que va al final de la key en R2. Mapea por mime exacto. */
  extensionByMime: Record<string, string>;
}

export const MEDIA_POLICY: Record<MediaKind, MediaPolicy> = {
  video: {
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    extensionByMime: {
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
    },
  },
  gif: {
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ['image/gif'],
    extensionByMime: {
      'image/gif': 'gif',
    },
  },
  image: {
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    extensionByMime: {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    },
  },
};

/** El `mediaType` que termina en `exercises.media_type` corresponde 1:1 al kind. */
export function kindToExerciseMediaType(kind: MediaKind): ExerciseMediaType {
  return kind;
}
