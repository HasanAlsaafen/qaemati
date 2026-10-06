import { addDays } from './billing-dates';

export type AccessState = 'ok' | 'trial' | 'grace' | 'blocked';
export type BlockReason = 'canceled' | 'suspended' | 'trial_ended' | 'expired';

export interface SubscriptionFacts {
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED';
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  graceDays: number;
}

export interface TenantAccess {
  state: AccessState;
  reason: BlockReason | null;
  /** When the paid or trial time ends. Null when it never does. */
  endsAt: Date | null;
  /** When the menu goes offline, the end plus the grace days. */
  blockAt: Date | null;
  /** Whole days until endsAt (trial or ok) or until blockAt (grace). */
  daysLeft: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function wholeDaysUntil(target: Date, now: Date): number {
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / DAY_MS));
}

/**
 * One place that decides what a tenant may do, so the public page, the admin
 * and the super admin screens never disagree. No subscription row counts as
 * fully allowed: restaurants created before billing existed keep working.
 */
export function computeAccess(subscription: SubscriptionFacts | null, now: Date): TenantAccess {
  if (!subscription) {
    return { state: 'ok', reason: null, endsAt: null, blockAt: null, daysLeft: null };
  }
  const { status, graceDays } = subscription;

  if (status === 'CANCELED') return blocked('canceled', subscription.currentPeriodEnd);
  if (status === 'SUSPENDED') return blocked('suspended', subscription.currentPeriodEnd);

  const trialing = status === 'TRIALING';
  const endsAt = trialing ? subscription.trialEndsAt : subscription.currentPeriodEnd;
  if (!endsAt) {
    return {
      state: trialing ? 'trial' : 'ok',
      reason: null,
      endsAt: null,
      blockAt: null,
      daysLeft: null,
    };
  }
  if (now <= endsAt) {
    return {
      state: trialing ? 'trial' : 'ok',
      reason: null,
      endsAt,
      blockAt: addDays(endsAt, graceDays),
      daysLeft: wholeDaysUntil(endsAt, now),
    };
  }
  const blockAt = addDays(endsAt, graceDays);
  if (now <= blockAt) {
    return {
      state: 'grace',
      reason: null,
      endsAt,
      blockAt,
      daysLeft: wholeDaysUntil(blockAt, now),
    };
  }
  return {
    state: 'blocked',
    reason: trialing ? 'trial_ended' : 'expired',
    endsAt,
    blockAt,
    daysLeft: 0,
  };
}

function blocked(reason: BlockReason, endsAt: Date | null): TenantAccess {
  return { state: 'blocked', reason, endsAt, blockAt: null, daysLeft: 0 };
}

export function isServable(access: TenantAccess): boolean {
  return access.state !== 'blocked';
}
