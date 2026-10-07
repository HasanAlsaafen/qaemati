import {
  canHandleCalls,
  canOpen,
  canSeeMoney,
  canSetOrderStatus,
  canEditSettings,
  homeFor,
  parseRole,
} from './roles';

describe('roles', () => {
  it('lets an owner open anything', () => {
    for (const path of [
      '/admin',
      '/admin/branding',
      '/admin/billing',
      '/admin/team',
      '/admin/pos',
    ]) {
      expect(canOpen('OWNER', path)).toBe(true);
    }
  });

  it.each(['CASHIER', 'KITCHEN'] as const)(
    'keeps %s to the orders screen and signing out',
    (role) => {
      expect(canOpen(role, '/admin/pos')).toBe(true);
      expect(canOpen(role, '/admin/pos/board')).toBe(true);
      expect(canOpen(role, '/admin/pos/orders/abc/status')).toBe(true);
      expect(canOpen(role, '/admin/logout')).toBe(true);
      for (const path of [
        '/admin',
        '/admin/branding',
        '/admin/billing',
        '/admin/team',
        '/admin/qr',
        '/admin/analytics',
        '/admin/bulk',
        '/admin/categories',
        '/admin/menus',
      ]) {
        expect(canOpen(role, path)).toBe(false);
      }
    },
  );

  it('does not let a path that only starts with an allowed one through', () => {
    expect(canOpen('CASHIER', '/admin/posx')).toBe(false);
    expect(canOpen('CASHIER', '/admin/pos-secrets')).toBe(false);
    expect(canOpen('KITCHEN', '/admin/logout/../branding')).toBe(false);
  });

  it('ignores the query string and a trailing slash', () => {
    expect(canOpen('KITCHEN', '/admin/pos/?x=1')).toBe(true);
    expect(canOpen('KITCHEN', '/admin/branding?next=/admin/pos')).toBe(false);
  });

  it('gives the kitchen only the first two steps, and the floor every step', () => {
    expect(canSetOrderStatus('KITCHEN', 'PREPARING')).toBe(true);
    expect(canSetOrderStatus('KITCHEN', 'READY')).toBe(true);
    expect(canSetOrderStatus('KITCHEN', 'SERVED')).toBe(false);
    expect(canSetOrderStatus('KITCHEN', 'CANCELED')).toBe(false);
    for (const status of ['PREPARING', 'READY', 'SERVED', 'CANCELED'] as const) {
      expect(canSetOrderStatus('CASHIER', status)).toBe(true);
      expect(canSetOrderStatus('OWNER', status)).toBe(true);
    }
  });

  it('hides calls and money from the kitchen, and settings from everyone but owners', () => {
    expect([canHandleCalls('KITCHEN'), canSeeMoney('KITCHEN')]).toEqual([false, false]);
    expect([canHandleCalls('CASHIER'), canSeeMoney('CASHIER')]).toEqual([true, true]);
    expect([
      canEditSettings('OWNER'),
      canEditSettings('CASHIER'),
      canEditSettings('KITCHEN'),
    ]).toEqual([true, false, false]);
  });

  it('sends staff to the orders screen after signing in', () => {
    expect(homeFor('OWNER')).toBe('/admin');
    expect(homeFor('CASHIER')).toBe('/admin/pos');
    expect(homeFor('KITCHEN')).toBe('/admin/pos');
  });

  it('only accepts the three real roles', () => {
    expect(parseRole('CASHIER')).toBe('CASHIER');
    expect(parseRole('ADMIN')).toBeNull();
    expect(parseRole(undefined)).toBeNull();
    expect(parseRole('owner')).toBeNull();
  });
});
