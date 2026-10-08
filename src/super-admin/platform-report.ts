import { computeAccess, SubscriptionFacts } from '../tenancy/tenant-access';

export interface PaymentFact {
  amount: number;
  currency: string;
  paidAt: Date;
}

export interface TenantFact {
  id: string;
  createdAt: Date;
  /** Has paid at least once, ever. */
  converted: boolean;
}

export interface SubscriptionFact extends SubscriptionFacts {
  canceledAt: Date | null;
  restaurant: { id: string; slug: string; nameAr: string; nameEn: string };
  plan: {
    id: string;
    nameAr: string;
    nameEn: string;
    currency: string;
    priceAmount: number;
    interval: 'MONTHLY' | 'YEARLY';
  };
}

export interface PlatformReport {
  months: string[];
  revenue: {
    currencies: string[];
    rows: { month: string; payments: number; byCurrency: Record<string, number> }[];
    totals: Record<string, number>;
  };
  signups: { month: string; created: number; converted: number; rate: number }[];
  losses: { month: string; canceled: number; lapsed: number }[];
  states: { ok: number; trial: number; grace: number; blocked: number };
  plans: {
    id: string;
    nameAr: string;
    nameEn: string;
    currency: string;
    running: number;
    paying: number;
    mrr: number;
  }[];
  renewals: {
    restaurant: SubscriptionFact['restaurant'];
    planAr: string;
    planEn: string;
    endsAt: Date;
    daysLeft: number;
    state: 'ok' | 'trial' | 'grace';
  }[];
}

export const monthKey = (date: Date): string => date.toISOString().slice(0, 7);

/** The last `count` calendar months ending with the one that holds `now`, oldest first (UTC). */
export function lastMonths(now: Date, count: number): string[] {
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    months.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return months;
}

export const RENEWAL_WINDOW_DAYS = 30;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Everything on the platform reports page, computed from plain facts so it can
 * be tested without a database. Money is never added across currencies. A
 * voided payment is not revenue, which is why the caller passes paid ones only.
 */
export function buildPlatformReport(input: {
  now: Date;
  months: number;
  payments: PaymentFact[];
  tenants: TenantFact[];
  subscriptions: SubscriptionFact[];
}): PlatformReport {
  const { now } = input;
  const months = lastMonths(now, input.months);
  const inRange = new Set(months);

  // Revenue per month and currency.
  const currencies = [...new Set(input.payments.map((p) => p.currency))].sort();
  const revenueRows = months.map((month) => ({
    month,
    payments: 0,
    byCurrency: Object.fromEntries(currencies.map((c) => [c, 0])) as Record<string, number>,
  }));
  const rowOf = new Map(revenueRows.map((row) => [row.month, row]));
  const totals: Record<string, number> = Object.fromEntries(currencies.map((c) => [c, 0]));
  for (const payment of input.payments) {
    const row = rowOf.get(monthKey(payment.paidAt));
    if (!row) continue;
    row.payments += 1;
    row.byCurrency[payment.currency] += payment.amount;
    totals[payment.currency] += payment.amount;
  }
  for (const row of revenueRows)
    for (const c of currencies) row.byCurrency[c] = round2(row.byCurrency[c]);
  for (const c of currencies) totals[c] = round2(totals[c]);

  // Restaurants that joined each month, and how many of them ever paid.
  const signups = months.map((month) => {
    const group = input.tenants.filter((t) => monthKey(t.createdAt) === month);
    const converted = group.filter((t) => t.converted).length;
    return {
      month,
      created: group.length,
      converted,
      rate: group.length ? converted / group.length : 0,
    };
  });

  const losses = months.map((month) => ({ month, canceled: 0, lapsed: 0 }));
  const lossOf = new Map(losses.map((row) => [row.month, row]));
  const states = { ok: 0, trial: 0, grace: 0, blocked: 0 };
  const planRows = new Map<string, PlatformReport['plans'][number]>();
  const renewals: PlatformReport['renewals'] = [];

  for (const sub of input.subscriptions) {
    const access = computeAccess(sub, now);
    states[access.state] += 1;

    if (sub.canceledAt && inRange.has(monthKey(sub.canceledAt)))
      lossOf.get(monthKey(sub.canceledAt))!.canceled += 1;
    // Lapsed: the grace period ran out and nobody paid. Suspended or canceled ones are the operator's doing.
    if (
      access.state === 'blocked' &&
      (access.reason === 'expired' || access.reason === 'trial_ended') &&
      access.blockAt &&
      inRange.has(monthKey(access.blockAt))
    ) {
      lossOf.get(monthKey(access.blockAt))!.lapsed += 1;
    }

    const plan = planRows.get(sub.plan.id) ?? {
      id: sub.plan.id,
      nameAr: sub.plan.nameAr,
      nameEn: sub.plan.nameEn,
      currency: sub.plan.currency,
      running: 0,
      paying: 0,
      mrr: 0,
    };
    if (access.state !== 'blocked') {
      plan.running += 1;
      if (sub.status === 'ACTIVE' || sub.status === 'PAST_DUE') {
        plan.paying += 1;
        const price = sub.plan.priceAmount;
        if (price > 0) plan.mrr += sub.plan.interval === 'YEARLY' ? price / 12 : price;
      }
    }
    planRows.set(sub.plan.id, plan);

    if (
      access.endsAt &&
      access.state !== 'blocked' &&
      access.daysLeft !== null &&
      access.endsAt.getTime() - now.getTime() <= RENEWAL_WINDOW_DAYS * 86_400_000
    ) {
      renewals.push({
        restaurant: sub.restaurant,
        planAr: sub.plan.nameAr,
        planEn: sub.plan.nameEn,
        endsAt: access.endsAt,
        daysLeft: access.state === 'grace' ? 0 : access.daysLeft,
        state: access.state,
      });
    }
  }
  renewals.sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime());

  return {
    months,
    revenue: { currencies, rows: revenueRows, totals },
    signups,
    losses,
    states,
    plans: [...planRows.values()]
      .map((p) => ({ ...p, mrr: round2(p.mrr) }))
      .sort((a, b) => b.running - a.running || a.nameEn.localeCompare(b.nameEn)),
    renewals,
  };
}
