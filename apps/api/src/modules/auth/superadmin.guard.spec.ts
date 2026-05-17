import { ExecutionContext, ForbiddenException } from '@nestjs/common';

import type { AuthenticatedUser } from './jwt-payload';
import { SuperadminGuard } from './superadmin.guard';

const ctxWith = (
  user: Partial<AuthenticatedUser> | undefined,
): ExecutionContext => {
  return {
    switchToHttp: () => ({
      getRequest: () => (user ? { user } : {}),
    }),
  } as unknown as ExecutionContext;
};

describe('SuperadminGuard', () => {
  const guard = new SuperadminGuard();

  it('deja pasar al SUPERADMIN', () => {
    expect(
      guard.canActivate(
        ctxWith({
          userId: 'u1',
          tenantId: null,
          role: null,
          isSuperadmin: true,
        }),
      ),
    ).toBe(true);
  });

  it('403 con `code: NOT_SUPERADMIN` cuando isSuperadmin=false', () => {
    expect(() =>
      guard.canActivate(
        ctxWith({
          userId: 'u1',
          tenantId: 't1',
          role: 'OWNER',
          isSuperadmin: false,
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('403 cuando no hay user en la request', () => {
    expect(() => guard.canActivate(ctxWith(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
