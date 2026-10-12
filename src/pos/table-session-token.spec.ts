import {
  isSessionIdle,
  readSessionCookie,
  readSocketTicket,
  sessionIdleMs,
  signSessionCookie,
  signSocketTicket,
  TICKET_TTL_MS,
} from './table-session-token';

describe('table session cookie', () => {
  it('round trips the session id', () => {
    expect(readSessionCookie(signSessionCookie('sess1'))).toBe('sess1');
  });

  it('rejects an edited id, an edited signature, and anything that is not text', () => {
    const [id, sig] = signSessionCookie('sess1').split('.');
    expect(readSessionCookie(`sess2.${sig}`)).toBeNull();
    expect(readSessionCookie(`${id}.${sig}x`)).toBeNull();
    expect(readSessionCookie('nodot')).toBeNull();
    expect(readSessionCookie(undefined)).toBeNull();
    expect(readSessionCookie(42)).toBeNull();
  });

  it('is not accepted as a socket ticket', () => {
    expect(readSocketTicket(signSessionCookie('sess1'))).toBeNull();
  });
});

describe('socket ticket', () => {
  const now = 1_000_000;

  it('is good until it expires', () => {
    const ticket = signSocketTicket('sess1', now);
    expect(readSocketTicket(ticket, now + TICKET_TTL_MS - 1)).toBe('sess1');
    expect(readSocketTicket(ticket, now + TICKET_TTL_MS + 1)).toBeNull();
  });

  it('cannot have its expiry extended', () => {
    const [id, , sig] = signSocketTicket('sess1', now).split('.');
    expect(readSocketTicket(`${id}.${now + 10 * TICKET_TTL_MS}.${sig}`, now)).toBeNull();
  });
});

describe('idle period', () => {
  it('defaults to six hours and follows the setting', () => {
    expect(sessionIdleMs(undefined)).toBe(6 * 3_600_000);
    expect(sessionIdleMs('2')).toBe(2 * 3_600_000);
    expect(sessionIdleMs('0')).toBe(6 * 3_600_000);
    expect(sessionIdleMs('abc')).toBe(6 * 3_600_000);
  });

  it('counts a session idle once the period has passed', () => {
    const now = new Date('2026-10-20T12:00:00Z');
    expect(isSessionIdle(new Date('2026-10-20T06:00:01Z'), now, 6 * 3_600_000)).toBe(false);
    expect(isSessionIdle(new Date('2026-10-20T06:00:00Z'), now, 6 * 3_600_000)).toBe(true);
  });
});
