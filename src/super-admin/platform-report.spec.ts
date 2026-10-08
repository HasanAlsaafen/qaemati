import { buildPlatformReport, lastMonths, SubscriptionFact } from './platform-report';

const now = new Date('2026-11-15T10:00:00Z');
const D = (iso: string) => new Date(iso);
const plan = (over: Partial<SubscriptionFact['plan']> = {}): SubscriptionFact['plan'] => ({
  id: 'p1',
  nameAr: 'باقة',
  nameEn: 'Plan',
  currency: 'ILS',
  priceAmount: 60,
  interval: 'MONTHLY',
  ...over,
});
const restaurant = (id: string) => ({ id, slug: id, nameAr: id, nameEn: id });
const sub = (id: string, over: Partial<SubscriptionFact> = {}): SubscriptionFact => ({
  status: 'ACTIVE',
  trialEndsAt: null,
  currentPeriodEnd: D('2027-01-01T00:00:00Z'),
  graceDays: 7,
  canceledAt: null,
  restaurant: restaurant(id),
  plan: plan(),
  ...over,
});
const report = (over: Partial<Parameters<typeof buildPlatformReport>[0]> = {}) =>
  buildPlatformReport({ now, months: 3, payments: [], tenants: [], subscriptions: [], ...over });

describe('lastMonths', () => {
  it('lists the months ending with the current one, across a year end', () => {
    expect(lastMonths(now, 3)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(lastMonths(D('2026-02-10T00:00:00Z'), 4)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });
});

describe('revenue', () => {
  it('adds payments per month and per currency, and never across currencies', () => {
    const r = report({
      payments: [
        { amount: 60, currency: 'ILS', paidAt: D('2026-11-01T12:00:00Z') },
        { amount: 40.5, currency: 'ILS', paidAt: D('2026-11-20T12:00:00Z') },
        { amount: 100, currency: 'USD', paidAt: D('2026-10-31T23:59:00Z') },
        { amount: 60, currency: 'ILS', paidAt: D('2026-09-01T00:00:00Z') },
      ],
    });
    expect(r.revenue.currencies).toEqual(['ILS', 'USD']);
    expect(r.revenue.rows.map((row) => row.month)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(r.revenue.rows[2]).toMatchObject({ payments: 2, byCurrency: { ILS: 100.5, USD: 0 } });
    expect(r.revenue.rows[1].byCurrency).toEqual({ ILS: 0, USD: 100 });
    expect(r.revenue.totals).toEqual({ ILS: 160.5, USD: 100 });
  });

  it('leaves out payments from before the window and shows empty months as zero', () => {
    const r = report({
      payments: [{ amount: 999, currency: 'ILS', paidAt: D('2025-01-01T00:00:00Z') }],
    });
    expect(r.revenue.totals.ILS).toBe(0);
    expect(r.revenue.rows.every((row) => row.payments === 0)).toBe(true);
  });

  it('does not drift on money that is not a whole number', () => {
    const r = report({
      payments: [0.1, 0.2, 0.3].map((amount) => ({
        amount,
        currency: 'ILS',
        paidAt: D('2026-11-02T00:00:00Z'),
      })),
    });
    expect(r.revenue.totals.ILS).toBe(0.6);
  });
});

describe('signups and conversion', () => {
  it('counts who joined each month and how many of them ever paid', () => {
    const r = report({
      tenants: [
        { id: 'a', createdAt: D('2026-10-05T00:00:00Z'), converted: true },
        { id: 'b', createdAt: D('2026-10-20T00:00:00Z'), converted: false },
        { id: 'c', createdAt: D('2026-10-21T00:00:00Z'), converted: false },
        { id: 'd', createdAt: D('2026-11-01T00:00:00Z'), converted: true },
        { id: 'old', createdAt: D('2020-01-01T00:00:00Z'), converted: true },
      ],
    });
    expect(r.signups).toEqual([
      { month: '2026-09', created: 0, converted: 0, rate: 0 },
      { month: '2026-10', created: 3, converted: 1, rate: 1 / 3 },
      { month: '2026-11', created: 1, converted: 1, rate: 1 },
    ]);
  });
});

describe('losses', () => {
  it('counts cancellations in the month they happened', () => {
    const r = report({
      subscriptions: [sub('a', { status: 'CANCELED', canceledAt: D('2026-10-12T00:00:00Z') })],
    });
    expect(r.losses.find((row) => row.month === '2026-10')).toEqual({
      month: '2026-10',
      canceled: 1,
      lapsed: 0,
    });
  });

  it('counts a plan that ran out and was never renewed, in the month its grace period ended', () => {
    // Ended 2026-10-20, grace to 2026-10-27, and it is November now.
    const r = report({
      subscriptions: [sub('a', { currentPeriodEnd: D('2026-10-20T00:00:00Z') })],
    });
    expect(r.losses.find((row) => row.month === '2026-10')!.lapsed).toBe(1);
    expect(r.states.blocked).toBe(1);
  });

  it('does not count a lapse the owner fixed by paying, nor a suspension by the operator', () => {
    const r = report({
      subscriptions: [
        sub('renewed', { currentPeriodEnd: D('2026-12-20T00:00:00Z') }),
        sub('suspended', { status: 'SUSPENDED', currentPeriodEnd: D('2026-10-20T00:00:00Z') }),
      ],
    });
    expect(r.losses.reduce((sum, row) => sum + row.lapsed, 0)).toBe(0);
  });

  it('counts an unpaid trial that ended as lapsed too', () => {
    const r = report({
      subscriptions: [
        sub('t', {
          status: 'TRIALING',
          trialEndsAt: D('2026-10-01T00:00:00Z'),
          currentPeriodEnd: null,
        }),
      ],
    });
    expect(r.losses.find((row) => row.month === '2026-10')!.lapsed).toBe(1);
  });
});

describe('plans and renewals', () => {
  it('counts running and paying restaurants per plan and the monthly revenue, yearly plans spread over 12', () => {
    const r = report({
      subscriptions: [
        sub('a'),
        sub('b'),
        sub('t', {
          status: 'TRIALING',
          trialEndsAt: D('2026-12-01T00:00:00Z'),
          currentPeriodEnd: null,
        }),
        sub('dead', { currentPeriodEnd: D('2026-01-01T00:00:00Z') }),
        sub('y', {
          plan: plan({ id: 'p2', nameEn: 'Yearly', priceAmount: 1200, interval: 'YEARLY' }),
        }),
      ],
    });
    expect(r.plans.find((p) => p.id === 'p1')).toMatchObject({ running: 3, paying: 2, mrr: 120 });
    expect(r.plans.find((p) => p.id === 'p2')).toMatchObject({ running: 1, paying: 1, mrr: 100 });
    expect(r.states).toEqual({ ok: 3, trial: 1, grace: 0, blocked: 1 });
  });

  it('lists what ends within 30 days, soonest first, and what is in its grace period', () => {
    const r = report({
      subscriptions: [
        sub('later', { currentPeriodEnd: D('2026-12-10T00:00:00Z') }),
        sub('soon', { currentPeriodEnd: D('2026-11-18T00:00:00Z') }),
        sub('grace', { currentPeriodEnd: D('2026-11-12T00:00:00Z') }),
        sub('far', { currentPeriodEnd: D('2027-06-01T00:00:00Z') }),
      ],
    });
    expect(r.renewals.map((x) => x.restaurant.id)).toEqual(['grace', 'soon', 'later']);
    expect(r.renewals[0]).toMatchObject({ state: 'grace', daysLeft: 0 });
    expect(r.renewals[1].daysLeft).toBe(3);
  });

  it('says nothing for an empty platform', () => {
    const r = report();
    expect(r.plans).toEqual([]);
    expect(r.renewals).toEqual([]);
    expect(r.revenue.currencies).toEqual([]);
  });
});

describe('parseMonths', () => {
  const { parseMonths } = jest.requireActual(
    './platform-reports.service',
  ) as typeof import('./platform-reports.service');
  it('accepts 6, 12 and 24 and falls back to 12 for anything else', () => {
    expect([parseMonths('6'), parseMonths('12'), parseMonths('24')]).toEqual([6, 12, 24]);
    for (const bad of [undefined, '', '7', '-1', '999999', 'abc', '12; DROP TABLE']) {
      expect(parseMonths(bad)).toBe(12);
    }
  });
});
