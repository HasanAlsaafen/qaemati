import { isAllowedIp, parseAllowlist } from './ip-allowlist';

describe('ip allowlist', () => {
  it('allows everyone when the list is empty', () => {
    expect(isAllowedIp('1.2.3.4', parseAllowlist(''))).toBe(true);
    expect(isAllowedIp(undefined, parseAllowlist(undefined))).toBe(true);
  });

  it('matches exact addresses, including IPv4 mapped into IPv6', () => {
    const list = parseAllowlist('203.0.113.7, 2001:db8::1');
    expect(isAllowedIp('203.0.113.7', list)).toBe(true);
    expect(isAllowedIp('::ffff:203.0.113.7', list)).toBe(true);
    expect(isAllowedIp('2001:DB8::1', list)).toBe(true);
    expect(isAllowedIp('203.0.113.8', list)).toBe(false);
  });

  it('matches IPv4 ranges', () => {
    const list = parseAllowlist('203.0.113.0/24,10.0.0.0/8');
    expect(isAllowedIp('203.0.113.200', list)).toBe(true);
    expect(isAllowedIp('203.0.114.1', list)).toBe(false);
    expect(isAllowedIp('10.255.255.255', list)).toBe(true);
    expect(isAllowedIp('11.0.0.1', list)).toBe(false);
  });

  it('refuses an unknown address once a list exists, and a broken range matches nothing', () => {
    expect(isAllowedIp(undefined, parseAllowlist('1.2.3.4'))).toBe(false);
    expect(isAllowedIp('1.2.3.4', parseAllowlist('1.2.3.4/99'))).toBe(false);
    expect(isAllowedIp('1.2.3.4', parseAllowlist('nonsense/8'))).toBe(false);
  });
});
