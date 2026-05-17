import { extractHostname, extractTenantSlug, isSuperadminHost } from './host';

describe('host helpers', () => {
  describe('extractHostname', () => {
    it('lee `host` y le quita el puerto', () => {
      expect(extractHostname({ host: 'superadmin.localhost:3001' })).toBe(
        'superadmin.localhost',
      );
    });

    it('da prioridad a `x-rutinex-host` sobre `host` (override en tests)', () => {
      expect(
        extractHostname({
          host: 'localhost:3001',
          'x-rutinex-host': 'superadmin.rutinex.app',
        }),
      ).toBe('superadmin.rutinex.app');
    });

    it('normaliza a lowercase', () => {
      expect(extractHostname({ host: 'SuperAdmin.Localhost' })).toBe(
        'superadmin.localhost',
      );
    });

    it('si el header es array (proxy raro) toma el primero', () => {
      expect(extractHostname({ host: ['olimpo.localhost:3000', 'b'] })).toBe(
        'olimpo.localhost',
      );
    });

    it('devuelve null si no hay host', () => {
      expect(extractHostname({})).toBeNull();
    });
  });

  describe('isSuperadminHost', () => {
    it('matchea `superadmin.<algo>`', () => {
      expect(isSuperadminHost('superadmin.rutinex.app')).toBe(true);
      expect(isSuperadminHost('superadmin.localhost')).toBe(true);
    });

    it('rechaza el bare `superadmin` (sin sufijo)', () => {
      expect(isSuperadminHost('superadmin')).toBe(false);
    });

    it('rechaza tenants y hosts vacíos', () => {
      expect(isSuperadminHost('olimpo.rutinex.app')).toBe(false);
      expect(isSuperadminHost('rutinex.app')).toBe(false);
      expect(isSuperadminHost('localhost')).toBe(false);
      expect(isSuperadminHost('')).toBe(false);
      expect(isSuperadminHost(null)).toBe(false);
    });

    it('no se deja engañar por substring (`xsuperadmin.foo`)', () => {
      expect(isSuperadminHost('xsuperadmin.foo')).toBe(false);
    });
  });

  describe('extractTenantSlug', () => {
    it('extrae el slug del primer label', () => {
      expect(extractTenantSlug('olimpo.rutinex.app')).toBe('olimpo');
      expect(extractTenantSlug('olimpo.localhost')).toBe('olimpo');
    });

    it('rechaza prefijos reservados', () => {
      expect(extractTenantSlug('superadmin.rutinex.app')).toBeNull();
      expect(extractTenantSlug('www.rutinex.app')).toBeNull();
    });

    it('rechaza hosts sin punto (apex o bare)', () => {
      expect(extractTenantSlug('rutinex.app')).toBe('rutinex');
      expect(extractTenantSlug('localhost')).toBeNull();
      expect(extractTenantSlug('')).toBeNull();
      expect(extractTenantSlug(null)).toBeNull();
    });

    it('rechaza slugs con caracteres inválidos (DNS-safe)', () => {
      expect(extractTenantSlug('Olimpo.localhost')).toBeNull(); // mayúsculas
      expect(extractTenantSlug('-olimpo.localhost')).toBeNull(); // empieza con guion
      expect(extractTenantSlug('olimpo_.localhost')).toBeNull(); // underscore
      expect(extractTenantSlug('olim po.localhost')).toBeNull(); // espacio
    });

    it('acepta slugs con guiones intermedios', () => {
      expect(extractTenantSlug('gym-olimpo.localhost')).toBe('gym-olimpo');
      expect(extractTenantSlug('a-b-c.localhost')).toBe('a-b-c');
    });
  });
});
