/**
 * Mock data compartida del interludio visual (Step 7.5).
 *
 * Esta data NO viene del API: la consumen los layouts/páginas del mockup
 * comercial mientras el backend no expone aún todas las entities. Cuando
 * Steps 21-28 ejecuten el reemplazo real (entities Exercise / Routine /
 * Session / Set), este archivo se borra.
 *
 * Reglas:
 *  - IDs cortos legibles (`u-student-1`, `ex-bench-press`) para debuggear
 *    el mockup sin tener que cruzar UUIDs.
 *  - Tenant de referencia para todas las demos: `olimpo` (`primaryColor`
 *    `#f97316`, naranja del proyecto).
 *  - Sin emojis. Nombres y copy en español argentino.
 */

export interface MockTenant {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  branding: { primaryColor: string; accentColor: string; logoUrl?: string };
  createdAt: string;
  studentsCount: number;
  trainersCount: number;
}

export type MockRole = 'OWNER' | 'TRAINER' | 'STUDENT';

export interface MockUser {
  id: string;
  tenantId: string | null;
  email: string | null;
  firstName: string;
  lastName: string;
  dni: string | null;
  role: MockRole | null;
  isSuperadmin: boolean;
  isActive: boolean;
  trainerId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface MockExercise {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  mediaType: 'video' | 'gif' | 'image' | 'none';
  muscleGroups: string[];
}

export interface MockRoutineItem {
  id: string;
  exerciseId: string;
  position: number;
  prescribedSets: number;
  prescribedReps: string;
  prescribedWeight: string | null;
  restSeconds: number | null;
  notes: string | null;
}

export interface MockRoutine {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  items: MockRoutineItem[];
}

export interface MockSession {
  id: string;
  studentId: string;
  routineId: string;
  startedAt: string;
  completedAt: string | null;
}

export interface MockSet {
  id: string;
  sessionId: string;
  routineItemId: string;
  exerciseId: string;
  setNumber: number;
  reps: number;
  weightKg: number | null;
}

export const DEMO_TENANT_SLUG = 'olimpo';

const OLIMPO_ID = 't-olimpo';

export const mockTenants: MockTenant[] = [
  {
    id: OLIMPO_ID,
    slug: 'olimpo',
    name: 'Gimnasio Olimpo',
    isActive: true,
    branding: { primaryColor: '#f97316', accentColor: '#fafafa' },
    createdAt: '2025-09-12T13:24:00.000Z',
    studentsCount: 14,
    trainersCount: 3,
  },
  {
    id: 't-arena',
    slug: 'arena',
    name: 'Arena Strength Club',
    isActive: true,
    branding: { primaryColor: '#dc2626', accentColor: '#f8fafc' },
    createdAt: '2025-10-04T09:00:00.000Z',
    studentsCount: 41,
    trainersCount: 5,
  },
  {
    id: 't-norte',
    slug: 'norte',
    name: 'Norte Functional',
    isActive: true,
    branding: { primaryColor: '#0ea5e9', accentColor: '#f0f9ff' },
    createdAt: '2025-08-21T17:42:00.000Z',
    studentsCount: 28,
    trainersCount: 2,
  },
  {
    id: 't-zenit',
    slug: 'zenit',
    name: 'Zenit Performance',
    isActive: true,
    branding: { primaryColor: '#a855f7', accentColor: '#faf5ff' },
    createdAt: '2025-11-02T11:10:00.000Z',
    studentsCount: 67,
    trainersCount: 8,
  },
  {
    id: 't-roca',
    slug: 'roca',
    name: 'Roca Powerlifting',
    isActive: true,
    branding: { primaryColor: '#16a34a', accentColor: '#f7fee7' },
    createdAt: '2025-07-30T08:00:00.000Z',
    studentsCount: 19,
    trainersCount: 2,
  },
  {
    id: 't-aura',
    slug: 'aura',
    name: 'Aura PT Estudio',
    isActive: false,
    branding: { primaryColor: '#eab308', accentColor: '#fefce8' },
    createdAt: '2025-06-14T15:00:00.000Z',
    studentsCount: 7,
    trainersCount: 1,
  },
  {
    id: 't-tigre',
    slug: 'tigre',
    name: 'Tigre Box Crossfit',
    isActive: true,
    branding: { primaryColor: '#ec4899', accentColor: '#fdf2f8' },
    createdAt: '2026-01-18T12:00:00.000Z',
    studentsCount: 53,
    trainersCount: 6,
  },
  {
    id: 't-faro',
    slug: 'faro',
    name: 'Faro Estudio PT',
    isActive: false,
    branding: { primaryColor: '#64748b', accentColor: '#f1f5f9' },
    createdAt: '2025-05-02T10:30:00.000Z',
    studentsCount: 4,
    trainersCount: 1,
  },
  {
    id: 't-sur',
    slug: 'sur',
    name: 'Sur Pesas y Calistenia',
    isActive: true,
    branding: { primaryColor: '#14b8a6', accentColor: '#f0fdfa' },
    createdAt: '2025-12-19T16:45:00.000Z',
    studentsCount: 22,
    trainersCount: 3,
  },
];

const olimpoTenantRef = mockTenants.find((t) => t.id === OLIMPO_ID);
if (!olimpoTenantRef) {
  throw new Error('mock-data: tenant olimpo no encontrado en mockTenants');
}
export const olimpoTenant: MockTenant = olimpoTenantRef;

export const olimpoOwner: MockUser = {
  id: 'u-owner-1',
  tenantId: OLIMPO_ID,
  email: 'gonzalo@olimpo.fit',
  firstName: 'Gonzalo',
  lastName: 'Ibáñez',
  dni: null,
  role: 'OWNER',
  isSuperadmin: false,
  isActive: true,
  trainerId: null,
  lastLoginAt: '2026-05-16T20:11:00.000Z',
  createdAt: '2025-09-12T13:24:00.000Z',
};

export const olimpoTrainers: MockUser[] = [
  {
    id: 'u-trainer-1',
    tenantId: OLIMPO_ID,
    email: 'mariana@olimpo.fit',
    firstName: 'Mariana',
    lastName: 'López',
    dni: null,
    role: 'TRAINER',
    isSuperadmin: false,
    isActive: true,
    trainerId: null,
    lastLoginAt: '2026-05-17T08:42:00.000Z',
    createdAt: '2025-09-20T10:00:00.000Z',
  },
  {
    id: 'u-trainer-2',
    tenantId: OLIMPO_ID,
    email: 'federico@olimpo.fit',
    firstName: 'Federico',
    lastName: 'Sosa',
    dni: null,
    role: 'TRAINER',
    isSuperadmin: false,
    isActive: true,
    trainerId: null,
    lastLoginAt: '2026-05-16T19:05:00.000Z',
    createdAt: '2025-10-08T12:30:00.000Z',
  },
  {
    id: 'u-trainer-3',
    tenantId: OLIMPO_ID,
    email: 'lucia@olimpo.fit',
    firstName: 'Lucía',
    lastName: 'Mendoza',
    dni: null,
    role: 'TRAINER',
    isSuperadmin: false,
    isActive: false,
    trainerId: null,
    lastLoginAt: '2026-02-11T17:00:00.000Z',
    createdAt: '2025-11-15T09:15:00.000Z',
  },
];

export const olimpoStudents: MockUser[] = [
  {
    id: 'u-student-1',
    tenantId: OLIMPO_ID,
    email: null,
    firstName: 'Camila',
    lastName: 'Fernández',
    dni: '38492718',
    role: 'STUDENT',
    isSuperadmin: false,
    isActive: true,
    trainerId: 'u-trainer-1',
    lastLoginAt: '2026-05-17T07:30:00.000Z',
    createdAt: '2025-10-01T15:00:00.000Z',
  },
  {
    id: 'u-student-2',
    tenantId: OLIMPO_ID,
    email: null,
    firstName: 'Tomás',
    lastName: 'Pereyra',
    dni: '40128394',
    role: 'STUDENT',
    isSuperadmin: false,
    isActive: true,
    trainerId: 'u-trainer-1',
    lastLoginAt: '2026-05-16T18:42:00.000Z',
    createdAt: '2025-10-04T11:20:00.000Z',
  },
  {
    id: 'u-student-3',
    tenantId: OLIMPO_ID,
    email: null,
    firstName: 'Sofía',
    lastName: 'Romano',
    dni: '37192083',
    role: 'STUDENT',
    isSuperadmin: false,
    isActive: true,
    trainerId: 'u-trainer-2',
    lastLoginAt: '2026-05-15T12:10:00.000Z',
    createdAt: '2025-10-09T09:00:00.000Z',
  },
  {
    id: 'u-student-4',
    tenantId: OLIMPO_ID,
    email: null,
    firstName: 'Bruno',
    lastName: 'Acosta',
    dni: '39084761',
    role: 'STUDENT',
    isSuperadmin: false,
    isActive: true,
    trainerId: 'u-trainer-1',
    lastLoginAt: '2026-05-17T06:55:00.000Z',
    createdAt: '2025-10-12T17:40:00.000Z',
  },
  {
    id: 'u-student-5',
    tenantId: OLIMPO_ID,
    email: null,
    firstName: 'Valentina',
    lastName: 'Quiroga',
    dni: '41203847',
    role: 'STUDENT',
    isSuperadmin: false,
    isActive: true,
    trainerId: 'u-trainer-2',
    lastLoginAt: '2026-05-14T19:30:00.000Z',
    createdAt: '2025-11-03T14:25:00.000Z',
  },
  {
    id: 'u-student-6',
    tenantId: OLIMPO_ID,
    email: null,
    firstName: 'Joaquín',
    lastName: 'Silva',
    dni: '36284910',
    role: 'STUDENT',
    isSuperadmin: false,
    isActive: true,
    trainerId: 'u-trainer-1',
    lastLoginAt: '2026-05-13T08:15:00.000Z',
    createdAt: '2025-11-09T10:00:00.000Z',
  },
  {
    id: 'u-student-7',
    tenantId: OLIMPO_ID,
    email: null,
    firstName: 'Martina',
    lastName: 'Gallo',
    dni: '40837192',
    role: 'STUDENT',
    isSuperadmin: false,
    isActive: true,
    trainerId: 'u-trainer-2',
    lastLoginAt: '2026-05-17T09:00:00.000Z',
    createdAt: '2025-11-22T13:00:00.000Z',
  },
  {
    id: 'u-student-8',
    tenantId: OLIMPO_ID,
    email: null,
    firstName: 'Lautaro',
    lastName: 'Benítez',
    dni: '38274610',
    role: 'STUDENT',
    isSuperadmin: false,
    isActive: true,
    trainerId: 'u-trainer-1',
    lastLoginAt: '2026-05-12T20:00:00.000Z',
    createdAt: '2025-12-04T16:30:00.000Z',
  },
  {
    id: 'u-student-9',
    tenantId: OLIMPO_ID,
    email: null,
    firstName: 'Antonella',
    lastName: 'Vargas',
    dni: '41928374',
    role: 'STUDENT',
    isSuperadmin: false,
    isActive: true,
    trainerId: 'u-trainer-2',
    lastLoginAt: '2026-05-16T17:45:00.000Z',
    createdAt: '2025-12-15T11:00:00.000Z',
  },
  {
    id: 'u-student-10',
    tenantId: OLIMPO_ID,
    email: null,
    firstName: 'Iván',
    lastName: 'Domínguez',
    dni: '37418205',
    role: 'STUDENT',
    isSuperadmin: false,
    isActive: false,
    trainerId: 'u-trainer-1',
    lastLoginAt: '2026-03-20T14:00:00.000Z',
    createdAt: '2026-01-10T09:30:00.000Z',
  },
  {
    id: 'u-student-11',
    tenantId: OLIMPO_ID,
    email: null,
    firstName: 'Florencia',
    lastName: 'Ramírez',
    dni: '40192847',
    role: 'STUDENT',
    isSuperadmin: false,
    isActive: true,
    trainerId: 'u-trainer-2',
    lastLoginAt: '2026-05-17T08:00:00.000Z',
    createdAt: '2026-01-20T12:00:00.000Z',
  },
  {
    id: 'u-student-12',
    tenantId: OLIMPO_ID,
    email: null,
    firstName: 'Maximiliano',
    lastName: 'Cabrera',
    dni: '36918274',
    role: 'STUDENT',
    isSuperadmin: false,
    isActive: true,
    trainerId: 'u-trainer-1',
    lastLoginAt: '2026-05-16T07:15:00.000Z',
    createdAt: '2026-02-02T18:00:00.000Z',
  },
  {
    id: 'u-student-13',
    tenantId: OLIMPO_ID,
    email: null,
    firstName: 'Agustina',
    lastName: 'Núñez',
    dni: '41827364',
    role: 'STUDENT',
    isSuperadmin: false,
    isActive: true,
    trainerId: 'u-trainer-2',
    lastLoginAt: '2026-05-15T19:10:00.000Z',
    createdAt: '2026-02-18T14:30:00.000Z',
  },
  {
    id: 'u-student-14',
    tenantId: OLIMPO_ID,
    email: null,
    firstName: 'Nicolás',
    lastName: 'Torres',
    dni: '38172094',
    role: 'STUDENT',
    isSuperadmin: false,
    isActive: false,
    trainerId: 'u-trainer-1',
    lastLoginAt: '2026-04-02T10:00:00.000Z',
    createdAt: '2026-03-01T11:00:00.000Z',
  },
];

export const mockUsers: MockUser[] = [
  olimpoOwner,
  ...olimpoTrainers,
  ...olimpoStudents,
];

export const mockExercises: MockExercise[] = [
  {
    id: 'ex-bench-press',
    tenantId: OLIMPO_ID,
    title: 'Press de banca',
    description:
      'Acostado en banca plana, llevá la barra al pecho sin perder contacto de la zona lumbar. Empujá hasta extender los codos sin trabarlos.',
    mediaType: 'video',
    muscleGroups: ['Pecho', 'Tríceps', 'Deltoides anterior'],
  },
  {
    id: 'ex-back-squat',
    tenantId: OLIMPO_ID,
    title: 'Sentadilla con barra',
    description:
      'Barra apoyada en trapecio alto. Bajá hasta romper paralelo manteniendo el torso firme. Empujá el piso con todo el pie.',
    mediaType: 'video',
    muscleGroups: ['Cuádriceps', 'Glúteos', 'Core'],
  },
  {
    id: 'ex-deadlift',
    tenantId: OLIMPO_ID,
    title: 'Peso muerto convencional',
    description:
      'Pies bajo cadera. Llevá la cadera atrás, mantené la espalda neutra y empujá el piso. La barra viaja pegada a las piernas.',
    mediaType: 'video',
    muscleGroups: ['Isquios', 'Glúteos', 'Espalda baja'],
  },
  {
    id: 'ex-barbell-row',
    tenantId: OLIMPO_ID,
    title: 'Remo con barra',
    description:
      'Torso inclinado a 45°, espalda neutra. Llevá la barra al abdomen tirando de los codos hacia atrás.',
    mediaType: 'gif',
    muscleGroups: ['Espalda media', 'Dorsal', 'Bíceps'],
  },
  {
    id: 'ex-overhead-press',
    tenantId: OLIMPO_ID,
    title: 'Press militar de pie',
    description:
      'Barra a la altura de los hombros. Empujá vertical sin arquear la zona lumbar. Bloqueá arriba.',
    mediaType: 'video',
    muscleGroups: ['Deltoides', 'Tríceps', 'Core'],
  },
  {
    id: 'ex-pull-up',
    tenantId: OLIMPO_ID,
    title: 'Dominadas',
    description:
      'Agarre prono al ancho de hombros. Tirá del pecho hacia la barra evitando balanceo. Bajá controlado.',
    mediaType: 'gif',
    muscleGroups: ['Dorsal', 'Bíceps', 'Espalda media'],
  },
  {
    id: 'ex-lunges',
    tenantId: OLIMPO_ID,
    title: 'Zancadas con mancuernas',
    description:
      'Pasos largos alternando piernas. Bajá hasta que la rodilla de atrás casi toque el piso. Torso erguido.',
    mediaType: 'image',
    muscleGroups: ['Cuádriceps', 'Glúteos'],
  },
  {
    id: 'ex-leg-press',
    tenantId: OLIMPO_ID,
    title: 'Prensa 45°',
    description:
      'Pies al ancho de cadera, parte alta de la plataforma. Bajá hasta 90° sin despegar la cadera.',
    mediaType: 'image',
    muscleGroups: ['Cuádriceps', 'Glúteos'],
  },
  {
    id: 'ex-romanian-deadlift',
    tenantId: OLIMPO_ID,
    title: 'Peso muerto rumano',
    description:
      'Barra pegada al cuerpo. Llevá la cadera atrás manteniendo rodillas semiflexionadas. Sentí tensión en isquios.',
    mediaType: 'video',
    muscleGroups: ['Isquios', 'Glúteos'],
  },
  {
    id: 'ex-plank',
    tenantId: OLIMPO_ID,
    title: 'Plancha frontal',
    description:
      'Apoyo en antebrazos y puntas de pie. Cuerpo en línea, glúteos activos, mirada al piso.',
    mediaType: 'image',
    muscleGroups: ['Core'],
  },
  {
    id: 'ex-face-pull',
    tenantId: OLIMPO_ID,
    title: 'Face pull con polea',
    description:
      'Cuerda a la altura de la cara. Tirá llevando los codos altos y abiertos, juntando escápulas.',
    mediaType: 'gif',
    muscleGroups: ['Deltoides posterior', 'Trapecio'],
  },
  {
    id: 'ex-bicep-curl',
    tenantId: OLIMPO_ID,
    title: 'Curl con barra',
    description:
      'Codos al costado, sin balanceo. Subí la barra hasta los hombros y bajá controlado.',
    mediaType: 'none',
    muscleGroups: ['Bíceps'],
  },
];

export const mockRoutines: MockRoutine[] = [
  {
    id: 'r-tren-superior',
    tenantId: OLIMPO_ID,
    name: 'Tren superior — Fuerza',
    description: 'Sesión de empuje y tracción enfocada en fuerza máxima.',
    items: [
      {
        id: 'ri-1',
        exerciseId: 'ex-bench-press',
        position: 1,
        prescribedSets: 4,
        prescribedReps: '5',
        prescribedWeight: 'RPE 8',
        restSeconds: 180,
        notes: 'Subí solo si la última serie quedó RPE 8 o menos.',
      },
      {
        id: 'ri-2',
        exerciseId: 'ex-barbell-row',
        position: 2,
        prescribedSets: 4,
        prescribedReps: '6-8',
        prescribedWeight: 'RPE 8',
        restSeconds: 150,
        notes: null,
      },
      {
        id: 'ri-3',
        exerciseId: 'ex-overhead-press',
        position: 3,
        prescribedSets: 3,
        prescribedReps: '6-8',
        prescribedWeight: 'RPE 7',
        restSeconds: 120,
        notes: 'Cuidá la lumbar, no arquear.',
      },
      {
        id: 'ri-4',
        exerciseId: 'ex-pull-up',
        position: 4,
        prescribedSets: 3,
        prescribedReps: 'AMRAP',
        prescribedWeight: null,
        restSeconds: 120,
        notes: 'Si pasás 12, agregá lastre.',
      },
      {
        id: 'ri-5',
        exerciseId: 'ex-face-pull',
        position: 5,
        prescribedSets: 3,
        prescribedReps: '12-15',
        prescribedWeight: null,
        restSeconds: 60,
        notes: null,
      },
    ],
  },
  {
    id: 'r-tren-inferior',
    tenantId: OLIMPO_ID,
    name: 'Tren inferior — Fuerza',
    description: 'Pierna pesada. Sentadilla principal + accesorios de cadera.',
    items: [
      {
        id: 'ri-6',
        exerciseId: 'ex-back-squat',
        position: 1,
        prescribedSets: 5,
        prescribedReps: '5',
        prescribedWeight: 'RPE 8',
        restSeconds: 210,
        notes: 'Rompé paralelo siempre.',
      },
      {
        id: 'ri-7',
        exerciseId: 'ex-romanian-deadlift',
        position: 2,
        prescribedSets: 4,
        prescribedReps: '8',
        prescribedWeight: 'RPE 7',
        restSeconds: 150,
        notes: null,
      },
      {
        id: 'ri-8',
        exerciseId: 'ex-lunges',
        position: 3,
        prescribedSets: 3,
        prescribedReps: '10 por pierna',
        prescribedWeight: null,
        restSeconds: 90,
        notes: null,
      },
      {
        id: 'ri-9',
        exerciseId: 'ex-leg-press',
        position: 4,
        prescribedSets: 3,
        prescribedReps: '12-15',
        prescribedWeight: null,
        restSeconds: 120,
        notes: 'Buscá congestión, no peso máximo.',
      },
      {
        id: 'ri-10',
        exerciseId: 'ex-plank',
        position: 5,
        prescribedSets: 3,
        prescribedReps: '45s',
        prescribedWeight: null,
        restSeconds: 60,
        notes: null,
      },
    ],
  },
  {
    id: 'r-full-body',
    tenantId: OLIMPO_ID,
    name: 'Full body — Volumen',
    description: 'Sesión integral para días con poco tiempo.',
    items: [
      {
        id: 'ri-11',
        exerciseId: 'ex-deadlift',
        position: 1,
        prescribedSets: 3,
        prescribedReps: '5',
        prescribedWeight: 'RPE 8',
        restSeconds: 180,
        notes: null,
      },
      {
        id: 'ri-12',
        exerciseId: 'ex-bench-press',
        position: 2,
        prescribedSets: 3,
        prescribedReps: '8',
        prescribedWeight: 'RPE 7',
        restSeconds: 120,
        notes: null,
      },
      {
        id: 'ri-13',
        exerciseId: 'ex-pull-up',
        position: 3,
        prescribedSets: 3,
        prescribedReps: 'AMRAP',
        prescribedWeight: null,
        restSeconds: 90,
        notes: null,
      },
      {
        id: 'ri-14',
        exerciseId: 'ex-bicep-curl',
        position: 4,
        prescribedSets: 3,
        prescribedReps: '10-12',
        prescribedWeight: null,
        restSeconds: 60,
        notes: null,
      },
    ],
  },
  {
    id: 'r-acondicionamiento',
    tenantId: OLIMPO_ID,
    name: 'Acondicionamiento general',
    description: 'Rutina liviana para alumnos en re-introducción.',
    items: [
      {
        id: 'ri-15',
        exerciseId: 'ex-leg-press',
        position: 1,
        prescribedSets: 3,
        prescribedReps: '12',
        prescribedWeight: null,
        restSeconds: 90,
        notes: null,
      },
      {
        id: 'ri-16',
        exerciseId: 'ex-barbell-row',
        position: 2,
        prescribedSets: 3,
        prescribedReps: '10',
        prescribedWeight: 'RPE 6',
        restSeconds: 90,
        notes: null,
      },
      {
        id: 'ri-17',
        exerciseId: 'ex-overhead-press',
        position: 3,
        prescribedSets: 3,
        prescribedReps: '10',
        prescribedWeight: 'RPE 6',
        restSeconds: 90,
        notes: null,
      },
      {
        id: 'ri-18',
        exerciseId: 'ex-plank',
        position: 4,
        prescribedSets: 3,
        prescribedReps: '30s',
        prescribedWeight: null,
        restSeconds: 45,
        notes: null,
      },
    ],
  },
];

export const mockSessions: MockSession[] = [
  // Sesión en curso de Camila.
  {
    id: 's-1',
    studentId: 'u-student-1',
    routineId: 'r-tren-superior',
    startedAt: '2026-05-17T11:20:00.000Z',
    completedAt: null,
  },
  // Histórico completado.
  {
    id: 's-2',
    studentId: 'u-student-1',
    routineId: 'r-tren-inferior',
    startedAt: '2026-05-15T11:00:00.000Z',
    completedAt: '2026-05-15T12:18:00.000Z',
  },
  {
    id: 's-3',
    studentId: 'u-student-2',
    routineId: 'r-tren-superior',
    startedAt: '2026-05-16T18:00:00.000Z',
    completedAt: '2026-05-16T19:24:00.000Z',
  },
  {
    id: 's-4',
    studentId: 'u-student-4',
    routineId: 'r-full-body',
    startedAt: '2026-05-17T07:00:00.000Z',
    completedAt: '2026-05-17T08:15:00.000Z',
  },
];

export const mockSets: MockSet[] = [
  // Sesión 1 — Camila, tren superior en curso. Ya hizo 2 series de banca.
  {
    id: 'set-1',
    sessionId: 's-1',
    routineItemId: 'ri-1',
    exerciseId: 'ex-bench-press',
    setNumber: 1,
    reps: 5,
    weightKg: 60,
  },
  {
    id: 'set-2',
    sessionId: 's-1',
    routineItemId: 'ri-1',
    exerciseId: 'ex-bench-press',
    setNumber: 2,
    reps: 5,
    weightKg: 62.5,
  },

  // Sesión 2 — Camila, tren inferior completo.
  {
    id: 'set-3',
    sessionId: 's-2',
    routineItemId: 'ri-6',
    exerciseId: 'ex-back-squat',
    setNumber: 1,
    reps: 5,
    weightKg: 70,
  },
  {
    id: 'set-4',
    sessionId: 's-2',
    routineItemId: 'ri-6',
    exerciseId: 'ex-back-squat',
    setNumber: 2,
    reps: 5,
    weightKg: 75,
  },
  {
    id: 'set-5',
    sessionId: 's-2',
    routineItemId: 'ri-6',
    exerciseId: 'ex-back-squat',
    setNumber: 3,
    reps: 5,
    weightKg: 80,
  },
  {
    id: 'set-6',
    sessionId: 's-2',
    routineItemId: 'ri-7',
    exerciseId: 'ex-romanian-deadlift',
    setNumber: 1,
    reps: 8,
    weightKg: 60,
  },
  {
    id: 'set-7',
    sessionId: 's-2',
    routineItemId: 'ri-7',
    exerciseId: 'ex-romanian-deadlift',
    setNumber: 2,
    reps: 8,
    weightKg: 62.5,
  },
  {
    id: 'set-8',
    sessionId: 's-2',
    routineItemId: 'ri-10',
    exerciseId: 'ex-plank',
    setNumber: 1,
    reps: 1,
    weightKg: null,
  },

  // Sesión 3 — Tomás, tren superior completo.
  {
    id: 'set-9',
    sessionId: 's-3',
    routineItemId: 'ri-1',
    exerciseId: 'ex-bench-press',
    setNumber: 1,
    reps: 5,
    weightKg: 80,
  },
  {
    id: 'set-10',
    sessionId: 's-3',
    routineItemId: 'ri-1',
    exerciseId: 'ex-bench-press',
    setNumber: 2,
    reps: 5,
    weightKg: 82.5,
  },
  {
    id: 'set-11',
    sessionId: 's-3',
    routineItemId: 'ri-1',
    exerciseId: 'ex-bench-press',
    setNumber: 3,
    reps: 5,
    weightKg: 85,
  },
  {
    id: 'set-12',
    sessionId: 's-3',
    routineItemId: 'ri-2',
    exerciseId: 'ex-barbell-row',
    setNumber: 1,
    reps: 8,
    weightKg: 60,
  },
  {
    id: 'set-13',
    sessionId: 's-3',
    routineItemId: 'ri-2',
    exerciseId: 'ex-barbell-row',
    setNumber: 2,
    reps: 8,
    weightKg: 62.5,
  },

  // Sesión 4 — Bruno, full body completo.
  {
    id: 'set-14',
    sessionId: 's-4',
    routineItemId: 'ri-11',
    exerciseId: 'ex-deadlift',
    setNumber: 1,
    reps: 5,
    weightKg: 100,
  },
  {
    id: 'set-15',
    sessionId: 's-4',
    routineItemId: 'ri-11',
    exerciseId: 'ex-deadlift',
    setNumber: 2,
    reps: 5,
    weightKg: 110,
  },
  {
    id: 'set-16',
    sessionId: 's-4',
    routineItemId: 'ri-11',
    exerciseId: 'ex-deadlift',
    setNumber: 3,
    reps: 5,
    weightKg: 115,
  },
];

export function getStudentById(id: string): MockUser | undefined {
  return olimpoStudents.find((s) => s.id === id);
}

export function getExerciseById(id: string): MockExercise | undefined {
  return mockExercises.find((e) => e.id === id);
}

export function getRoutineById(id: string): MockRoutine | undefined {
  return mockRoutines.find((r) => r.id === id);
}

/**
 * Heurística de "rutina de hoy" para el mockup:
 *  1) Si el alumno tiene una sesión en curso, devolvemos esa rutina.
 *  2) Si no, asignamos por hash estable del studentId para que un mismo
 *     alumno siempre vea la misma rutina (no flickeen entre cargas).
 */
export function getRoutineForStudentToday(
  studentId: string,
): MockRoutine | undefined {
  const inProgress = mockSessions.find(
    (s) => s.studentId === studentId && s.completedAt === null,
  );
  if (inProgress) {
    return getRoutineById(inProgress.routineId);
  }

  if (mockRoutines.length === 0) return undefined;
  let hash = 0;
  for (const ch of studentId) {
    hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  }
  const idx = Math.abs(hash) % mockRoutines.length;
  return mockRoutines[idx];
}

export function getStudentsByTrainerId(trainerId: string): MockUser[] {
  return olimpoStudents.filter((s) => s.trainerId === trainerId);
}
