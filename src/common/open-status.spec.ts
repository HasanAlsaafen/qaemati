import { computeOpenStatus, isCategoryAvailableNow, nowInHebronMinutes } from './open-status';

describe('computeOpenStatus', () => {
  it('is open during a same-day range', () => {
    const status = computeOpenStatus('07:00', '23:00', 12 * 60);
    expect(status.isOpen).toBe(true);
    expect(status.nextChangeTime).toBe('23:00');
  });

  it('is closed before a same-day range opens', () => {
    const status = computeOpenStatus('07:00', '23:00', 6 * 60);
    expect(status.isOpen).toBe(false);
    expect(status.nextChangeTime).toBe('07:00');
  });

  it('is closed after a same-day range closes', () => {
    const status = computeOpenStatus('07:00', '23:00', 23 * 60 + 1);
    expect(status.isOpen).toBe(false);
    expect(status.nextChangeTime).toBe('07:00');
  });

  it('treats the opening minute as open', () => {
    const status = computeOpenStatus('07:00', '23:00', 7 * 60);
    expect(status.isOpen).toBe(true);
  });

  it('treats the closing minute as closed', () => {
    const status = computeOpenStatus('07:00', '23:00', 23 * 60);
    expect(status.isOpen).toBe(false);
  });

  it('handles an overnight range, open side', () => {
    // 20:00-02:00: open at 23:00
    const status = computeOpenStatus('20:00', '02:00', 23 * 60);
    expect(status.isOpen).toBe(true);
    expect(status.nextChangeTime).toBe('02:00');
  });

  it('handles an overnight range, past midnight still open', () => {
    // 20:00-02:00: open at 01:00 (next calendar day)
    const status = computeOpenStatus('20:00', '02:00', 1 * 60);
    expect(status.isOpen).toBe(true);
  });

  it('handles an overnight range, closed during the day', () => {
    // 20:00-02:00: closed at 12:00
    const status = computeOpenStatus('20:00', '02:00', 12 * 60);
    expect(status.isOpen).toBe(false);
    expect(status.nextChangeTime).toBe('20:00');
  });
});

describe('isCategoryAvailableNow', () => {
  it('is always available when no window is set', () => {
    expect(isCategoryAvailableNow(null, null, 3 * 60)).toBe(true);
  });

  it('is available inside the window', () => {
    expect(isCategoryAvailableNow('07:00', '11:00', 9 * 60)).toBe(true);
  });

  it('is unavailable before the window opens', () => {
    expect(isCategoryAvailableNow('07:00', '11:00', 6 * 60)).toBe(false);
  });

  it('is unavailable at or after the window closes', () => {
    expect(isCategoryAvailableNow('07:00', '11:00', 11 * 60)).toBe(false);
  });

  it('treats the opening minute as available', () => {
    expect(isCategoryAvailableNow('07:00', '11:00', 7 * 60)).toBe(true);
  });
});

describe('nowInHebronMinutes', () => {
  it('returns a value in the valid minutes-of-day range', () => {
    const minutes = nowInHebronMinutes();
    expect(minutes).toBeGreaterThanOrEqual(0);
    expect(minutes).toBeLessThan(24 * 60);
  });

  it('computes the correct minutes for a known UTC instant', () => {
    // Asia/Hebron is UTC+2 (standard) or UTC+3 (DST); either way, noon
    // UTC lands well clear of a day boundary, so this just sanity-checks
    // the hour/minute parsing rather than pinning an exact DST offset.
    const minutes = nowInHebronMinutes(new Date('2026-06-15T12:00:00.000Z'));
    expect(minutes).toBeGreaterThan(13 * 60);
    expect(minutes).toBeLessThan(16 * 60);
  });
});
