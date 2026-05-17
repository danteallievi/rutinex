import * as argon2 from 'argon2';

import {
  ARGON2_OPTIONS,
  GENERATED_PASSWORD_ALPHABET,
  GENERATED_PASSWORD_LENGTH,
  PasswordService,
} from './password.service';

describe('PasswordService', () => {
  // Argon2id con memoryCost=19456 corre en ~50-200ms por hash; cada test acá
  // hace 1-2 hashes así que el default de 5s alcanza, pero damos algo de holgura.
  jest.setTimeout(15_000);

  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  describe('hash + verify', () => {
    it('roundtrip: una password se hashea y se verifica OK', async () => {
      const plain = 'una-password-cualquiera-123';
      const hash = await service.hash(plain);

      expect(hash).toMatch(/^\$argon2id\$/);
      await expect(service.verify(hash, plain)).resolves.toBe(true);
    });

    it('verify rechaza una password incorrecta', async () => {
      const hash = await service.hash('correcta');

      await expect(service.verify(hash, 'incorrecta')).resolves.toBe(false);
    });

    it('verify devuelve false (no throw) cuando el hash está corrupto', async () => {
      await expect(service.verify('no-es-un-hash', 'lo-que-sea')).resolves.toBe(
        false,
      );
    });

    it('emite hashes con los parámetros Argon2id configurados', async () => {
      const hash = await service.hash('params-check');

      // El string de Argon2 contiene `m=<memoryCost>,t=<timeCost>,p=<parallelism>`.
      expect(hash).toContain(`m=${ARGON2_OPTIONS.memoryCost}`);
      expect(hash).toContain(`t=${ARGON2_OPTIONS.timeCost}`);
      expect(hash).toContain(`p=${ARGON2_OPTIONS.parallelism}`);
      // Sanity check: el algoritmo es efectivamente argon2id.
      expect(ARGON2_OPTIONS.type).toBe(argon2.argon2id);
    });
  });

  describe('generate', () => {
    it('produce un string del largo configurado', () => {
      for (let i = 0; i < 20; i++) {
        const pw = service.generate();
        expect(pw).toHaveLength(GENERATED_PASSWORD_LENGTH);
      }
    });

    it('solo usa caracteres del alfabeto permitido', () => {
      const allowed = new Set(GENERATED_PASSWORD_ALPHABET);

      for (let i = 0; i < 50; i++) {
        const pw = service.generate();
        for (const ch of pw) {
          expect(allowed.has(ch)).toBe(true);
        }
      }
    });

    it('nunca incluye los caracteres ambiguos 0, O, o, 1, l, I', () => {
      const forbidden = /[0Oo1lI]/;
      for (let i = 0; i < 100; i++) {
        const pw = service.generate();
        expect(pw).not.toMatch(forbidden);
      }
    });

    it('cada invocación es distinta (no constante)', () => {
      const samples = new Set<string>();
      for (let i = 0; i < 20; i++) samples.add(service.generate());
      // Con 16 chars de un alfabeto de 56, la probabilidad de colisión
      // en 20 muestras es ~0. Si pasa, algo está roto.
      expect(samples.size).toBe(20);
    });
  });
});
