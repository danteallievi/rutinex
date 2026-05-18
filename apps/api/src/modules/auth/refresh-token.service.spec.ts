import { createHash } from 'node:crypto';

import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { IsNull } from 'typeorm';

import { RefreshToken } from './entities/refresh-token.entity';
import { REFRESH_TOKEN_TTL_MS } from './refresh-token.constants';
import { RefreshTokenService } from './refresh-token.service';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const TENANT_ID = '22222222-2222-2222-2222-222222222222';
const ROW_ID = '33333333-3333-3333-3333-333333333333';

// `expect.any(Date)` devuelve `any`; casteamos a `unknown` para evitar el
// trigger de `@typescript-eslint/no-unsafe-assignment` cuando lo usamos
// dentro de `objectContaining`.
const anyDate: unknown = expect.any(Date);

const sha256 = (s: string): string =>
  createHash('sha256').update(s).digest('hex');

const makeRow = (overrides: Partial<RefreshToken> = {}): RefreshToken => ({
  id: ROW_ID,
  tenantId: TENANT_ID,
  userId: USER_ID,
  tokenHash: 'preexistente-hash',
  expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  revokedAt: null,
  replacedBy: null,
  userAgent: 'jest',
  ip: '127.0.0.1',
  createdAt: new Date(),
  ...overrides,
});

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  const repo = {
    create: jest.fn((x: Partial<RefreshToken>) => x as RefreshToken),
    save: jest.fn<Promise<RefreshToken>, [RefreshToken]>(),
    findOne: jest.fn<Promise<RefreshToken | null>, [unknown]>(),
    update: jest.fn<Promise<{ affected?: number }>, [unknown, unknown]>(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    repo.create.mockImplementation((x) => x as RefreshToken);
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        { provide: getRepositoryToken(RefreshToken), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(RefreshTokenService);
  });

  describe('issue', () => {
    it('genera token base64url y persiste el hash SHA-256', async () => {
      let saved: RefreshToken | null = null;
      repo.save.mockImplementation((row: RefreshToken) => {
        saved = { ...row, id: ROW_ID, createdAt: new Date() };
        return Promise.resolve(saved);
      });

      const out = await service.issue({
        userId: USER_ID,
        tenantId: TENANT_ID,
        userAgent: 'jest',
        ip: '127.0.0.1',
      });

      expect(out.token).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
      expect(out.token.length).toBeGreaterThan(80);
      expect(saved!.userId).toBe(USER_ID);
      expect(saved!.tenantId).toBe(TENANT_ID);
      expect(saved!.tokenHash).toBe(sha256(out.token));
      expect(saved!.tokenHash).toHaveLength(64);
      expect(saved!.revokedAt).toBeNull();
      expect(saved!.replacedBy).toBeNull();
      expect(out.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('persiste tenantId=null para SUPERADMINs', async () => {
      let saved: RefreshToken | null = null;
      repo.save.mockImplementation((row: RefreshToken) => {
        saved = { ...row, id: ROW_ID };
        return Promise.resolve(saved);
      });

      await service.issue({
        userId: USER_ID,
        tenantId: null,
        userAgent: null,
        ip: null,
      });
      expect(saved!.tenantId).toBeNull();
    });

    it('no devuelve nunca dos veces el mismo token (sanity)', async () => {
      repo.save.mockImplementation((row: RefreshToken) => Promise.resolve(row));
      const a = await service.issue({
        userId: USER_ID,
        tenantId: null,
        userAgent: null,
        ip: null,
      });
      const b = await service.issue({
        userId: USER_ID,
        tenantId: null,
        userAgent: null,
        ip: null,
      });
      expect(a.token).not.toBe(b.token);
    });
  });

  describe('rotate', () => {
    it('rota: revoca el viejo, crea uno nuevo y setea replaced_by', async () => {
      const existing = makeRow({ tokenHash: sha256('viejo') });
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockImplementation((row: RefreshToken) =>
        Promise.resolve({ ...row, id: 'new-id' }),
      );
      repo.update.mockResolvedValue({ affected: 1 });

      const out = await service.rotate({
        presentedToken: 'viejo',
        userAgent: 'jest',
        ip: '127.0.0.1',
      });

      expect(out.userId).toBe(USER_ID);
      expect(out.tenantId).toBe(TENANT_ID);
      expect(out.token).not.toBe('viejo');
      expect(repo.update).toHaveBeenCalledWith(
        { id: ROW_ID },
        expect.objectContaining({
          revokedAt: anyDate,
          replacedBy: 'new-id',
        }),
      );
    });

    it('401 si el token no existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.rotate({
          presentedToken: 'no-existe',
          userAgent: null,
          ip: null,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('detección de reuso: si el token está revocado, revoca todos los del user', async () => {
      const revoked = makeRow({
        tokenHash: sha256('reusado'),
        revokedAt: new Date(Date.now() - 60_000),
      });
      repo.findOne.mockResolvedValue(revoked);
      repo.update.mockResolvedValue({ affected: 3 });

      await expect(
        service.rotate({
          presentedToken: 'reusado',
          userAgent: null,
          ip: null,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      // Tira el update de "revocar todos los del user" y no el de rotación.
      expect(repo.update).toHaveBeenCalledWith(
        { userId: USER_ID, revokedAt: IsNull() },
        expect.objectContaining({ revokedAt: anyDate }),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('401 si el token está expirado', async () => {
      const expired = makeRow({
        tokenHash: sha256('viejo'),
        expiresAt: new Date(Date.now() - 1000),
      });
      repo.findOne.mockResolvedValue(expired);

      await expect(
        service.rotate({ presentedToken: 'viejo', userAgent: null, ip: null }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('marca revoked_at si existe y está activo', async () => {
      repo.update.mockResolvedValue({ affected: 1 });
      const out = await service.revoke('abc');
      expect(out).toBe(true);
      expect(repo.update).toHaveBeenCalledWith(
        { tokenHash: sha256('abc'), revokedAt: IsNull() },
        expect.objectContaining({ revokedAt: anyDate }),
      );
    });

    it('no-op si el token no existe o ya estaba revocado', async () => {
      repo.update.mockResolvedValue({ affected: 0 });
      const out = await service.revoke('abc');
      expect(out).toBe(false);
    });
  });

  describe('revokeAllForUser', () => {
    it('revoca todos los activos del user', async () => {
      repo.update.mockResolvedValue({ affected: 4 });
      const out = await service.revokeAllForUser(USER_ID);
      expect(out).toBe(4);
      expect(repo.update).toHaveBeenCalledWith(
        { userId: USER_ID, revokedAt: IsNull() },
        expect.objectContaining({ revokedAt: anyDate }),
      );
    });
  });
});
