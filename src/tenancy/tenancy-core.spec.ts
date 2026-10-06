import { addDays, addMonths, nextPeriod } from './billing-dates';
import { computeAccess, SubscriptionFacts } from './tenant-access';

const now = new Date('2026-10-10T12:00:00Z');
const base: SubscriptionFacts = {
  status: 'ACTIVE',
  trialEndsAt: null,
  currentPeriodEnd: null,
  graceDays: 7,
};

describe('addMonths', () => {
  it('clamps to the last day of a shorter month', () => {
    expect(addMonths(new Date('2026-01-31T00:00:00Z'), 1).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
    expect(addMonths(new Date('2028-01-31T00:00:00Z'), 1).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
  });

  it('crosses a year end', () => {
    expect(addMonths(new Date('2026-11-15T00:00:00Z'), 3).toISOString()).toBe(
      '2027-02-15T00:00:00.000Z',
    );
  });
});

describe('nextPeriod', () => {
  it('continues from the end of time already paid for', () => {
    const end = new Date('2026-10-20T00:00:00Z');
    const { start, end: next } = nextPeriod(end, new Date('2026-10-10T00:00:00Z'), 'MONTHLY', 1);
    expect(start).toEqual(end);
    expect(next.toISOString()).toBe('2026-11-20T00:00:00.000Z');
  });

  it('starts at the payment date when the subscription already lapsed', () => {
    const paid = new Date('2026-10-10T00:00:00Z');
    const { start, end } = nextPeriod(new Date('2026-09-01T00:00:00Z'), paid, 'YEARLY', 1);
    expect(start).toEqual(paid);
    expect(end.toISOString()).toBe('2027-10-10T00:00:00.000Z');
  });

  it('starts at the payment date for a first payment', () => {
    const paid = new Date('2026-10-10T00:00:00Z');
    expect(nextPeriod(null, paid, 'MONTHLY', 3).end.toISOString()).toBe('2027-01-10T00:00:00.000Z');
  });
});

describe('computeAccess', () => {
  it('allows a restaurant with no subscription row', () => {
    expect(computeAccess(null, now).state).toBe('ok');
  });

  it('allows an active subscription that never expires', () => {
    expect(computeAccess(base, now)).toMatchObject({ state: 'ok', endsAt: null, daysLeft: null });
  });

  it('allows an active subscription inside its period and counts the days left', () => {
    const access = computeAccess({ ...base, currentPeriodEnd: addDays(now, 5) }, now);
    expect(access).toMatchObject({ state: 'ok', daysLeft: 5 });
  });

  it('enters the grace period right after the period ends', () => {
    const access = computeAccess({ ...base, currentPeriodEnd: addDays(now, -1) }, now);
    expect(access.state).toBe('grace');
    expect(access.daysLeft).toBe(6);
    expect(access.blockAt).toEqual(addDays(addDays(now, -1), 7));
  });

  it('blocks once the grace period is over', () => {
    const access = computeAccess({ ...base, currentPeriodEnd: addDays(now, -8) }, now);
    expect(access).toMatchObject({ state: 'blocked', reason: 'expired' });
  });

  it('treats the last second of the grace period as still allowed', () => {
    const end = addDays(now, -7);
    expect(computeAccess({ ...base, currentPeriodEnd: end }, now).state).toBe('grace');
    expect(
      computeAccess({ ...base, currentPeriodEnd: new Date(end.getTime() - 1000) }, now).state,
    ).toBe('blocked');
  });

  it('keeps a past due subscription up until grace ends, like an active one', () => {
    expect(
      computeAccess({ ...base, status: 'PAST_DUE', currentPeriodEnd: addDays(now, -2) }, now).state,
    ).toBe('grace');
  });

  it('reports a running trial and a finished one', () => {
    expect(
      computeAccess({ ...base, status: 'TRIALING', trialEndsAt: addDays(now, 3) }, now),
    ).toMatchObject({ state: 'trial', daysLeft: 3 });
    expect(
      computeAccess({ ...base, status: 'TRIALING', trialEndsAt: addDays(now, -2) }, now).state,
    ).toBe('grace');
    expect(
      computeAccess({ ...base, status: 'TRIALING', trialEndsAt: addDays(now, -20) }, now),
    ).toMatchObject({ state: 'blocked', reason: 'trial_ended' });
  });

  it('blocks suspended and canceled subscriptions at once, whatever the dates say', () => {
    const future = addDays(now, 30);
    expect(
      computeAccess({ ...base, status: 'SUSPENDED', currentPeriodEnd: future }, now),
    ).toMatchObject({ state: 'blocked', reason: 'suspended' });
    expect(
      computeAccess({ ...base, status: 'CANCELED', currentPeriodEnd: future }, now),
    ).toMatchObject({ state: 'blocked', reason: 'canceled' });
  });

  it('honours a custom grace length, including none', () => {
    expect(
      computeAccess({ ...base, graceDays: 0, currentPeriodEnd: addDays(now, -1) }, now).state,
    ).toBe('blocked');
    expect(
      computeAccess({ ...base, graceDays: 30, currentPeriodEnd: addDays(now, -20) }, now).state,
    ).toBe('grace');
  });
});
