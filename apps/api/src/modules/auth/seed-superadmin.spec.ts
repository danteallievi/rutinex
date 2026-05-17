import { ConflictException } from '@nestjs/common';

import {
  isSuperadminEmailTakenError,
  MIN_HUMAN_PASSWORD_LENGTH,
  seedSuperadmin,
  validateSeedInput,
} from './seed-superadmin';

describe('seedSuperadmin helpers', () => {
  describe('validateSeedInput', () => {
    it('acepta input válido', () => {
      expect(() =>
        validateSeedInput({
          email: 'super@rutinex.app',
          password: 'una-password-larga',
        }),
      ).not.toThrow();
    });

    it('rechaza email inválido', () => {
      expect(() =>
        validateSeedInput({
          email: 'no-arroba',
          password: 'una-password-larga',
        }),
      ).toThrow(/Email inválido/);
    });

    it(`rechaza password con menos de ${String(MIN_HUMAN_PASSWORD_LENGTH)} chars`, () => {
      expect(() =>
        validateSeedInput({
          email: 'super@rutinex.app',
          password: 'corta',
        }),
      ).toThrow(/al menos 12/);
    });
  });

  describe('seedSuperadmin', () => {
    const usersService = {
      create: jest.fn(),
    };
    const passwordService = {
      hash: jest.fn<Promise<string>, [string]>(),
    };

    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('llama a UsersService.create con flags de SUPERADMIN y email lowercase', async () => {
      passwordService.hash.mockResolvedValue('hashed');
      usersService.create.mockResolvedValue({ id: 'u1' });

      await seedSuperadmin(usersService as never, passwordService as never, {
        email: '  Super@Rutinex.App  ',
        password: 'una-password-larga',
      });

      expect(passwordService.hash).toHaveBeenCalledWith('una-password-larga');
      expect(usersService.create).toHaveBeenCalledWith({
        tenantId: null,
        role: null,
        isSuperadmin: true,
        email: 'super@rutinex.app',
        passwordHash: 'hashed',
        firstName: 'Super',
        lastName: 'Admin',
        mustChangePassword: false,
      });
    });

    it('propaga la validación antes de tocar password/users', async () => {
      await expect(
        seedSuperadmin(usersService as never, passwordService as never, {
          email: 'no-arroba',
          password: 'una-password-larga',
        }),
      ).rejects.toThrow(/Email inválido/);
      expect(passwordService.hash).not.toHaveBeenCalled();
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('isSuperadminEmailTakenError', () => {
    it('detecta el ConflictException con code=SUPERADMIN_EMAIL_TAKEN', () => {
      const err = new ConflictException({
        code: 'SUPERADMIN_EMAIL_TAKEN',
        message: 'x',
      });
      expect(isSuperadminEmailTakenError(err)).toBe(true);
    });

    it('rechaza otros conflicts', () => {
      const err = new ConflictException({ code: 'EMAIL_TAKEN', message: 'x' });
      expect(isSuperadminEmailTakenError(err)).toBe(false);
    });

    it('rechaza errores random', () => {
      expect(isSuperadminEmailTakenError(new Error('x'))).toBe(false);
      expect(isSuperadminEmailTakenError(null)).toBe(false);
    });
  });
});
