import { IDLE_MS, tableState } from './table-state';

const now = new Date('2026-10-20T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

describe('tableState', () => {
  it('is free when there is no visit', () => {
    expect(tableState({ occupiedAt: null, lastSeenAt: null, billRequestedAt: null }, 0, now)).toBe(
      'FREE',
    );
  });

  it('is occupied while a scan is fresh', () => {
    const t = { occupiedAt: ago(60_000), lastSeenAt: ago(60_000), billRequestedAt: null };
    expect(tableState(t, 0, now)).toBe('OCCUPIED');
  });

  it('lapses when a scan with no orders goes quiet', () => {
    const t = { occupiedAt: ago(IDLE_MS + 1), lastSeenAt: ago(IDLE_MS), billRequestedAt: null };
    expect(tableState(t, 0, now)).toBe('FREE');
  });

  it('stays occupied however quiet it is once there are orders', () => {
    const t = { occupiedAt: ago(5 * IDLE_MS), lastSeenAt: ago(5 * IDLE_MS), billRequestedAt: null };
    expect(tableState(t, 2, now)).toBe('OCCUPIED');
  });

  it('shows the bill request', () => {
    const t = { occupiedAt: ago(1000), lastSeenAt: ago(1000), billRequestedAt: ago(500) };
    expect(tableState(t, 1, now)).toBe('BILL');
  });

  it('uses the start of the visit when it was never seen again', () => {
    const t = { occupiedAt: ago(IDLE_MS), lastSeenAt: null, billRequestedAt: null };
    expect(tableState(t, 0, now)).toBe('FREE');
  });
});
