import { computeAccess, SubscriptionFacts } from '../tenancy/tenant-access';

export type NoticeKind =
  'trial_ending' | 'expiring_7d' | 'expiring_1d' | 'grace_started' | 'menu_offline';

export interface PlannedNotice {
  kind: NoticeKind;
  /** The day the trial or the paid period ends. */
  forDate: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** A menu that went offline long ago is not worth another email. */
const OFFLINE_NOTICE_WINDOW_DAYS = 14;

export const TRIAL_REMINDER_DAYS = 3;

/** The calendar day of a moment, as a UTC date, so it can be a database DATE key. */
export const dayOf = (date: Date): Date =>
  new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

/**
 * Which emails a subscription is due for right now. It never looks at what was
 * already sent: the caller claims each one in the database, which is what
 * makes a notice go out once. Only the most urgent of "7 days" and "1 day" is
 * planned, so a subscription first seen on its last day does not get two.
 * Suspended and canceled subscriptions get nothing: that was a decision by
 * the operator, not a lapse to remind about.
 */
export function planNotices(facts: SubscriptionFacts, now: Date): PlannedNotice[] {
  const access = computeAccess(facts, now);
  const endsAt = access.endsAt;
  if (!endsAt) return [];
  const forDate = dayOf(endsAt);
  const msLeft = endsAt.getTime() - now.getTime();

  switch (access.state) {
    case 'trial':
      return msLeft <= TRIAL_REMINDER_DAYS * DAY_MS ? [{ kind: 'trial_ending', forDate }] : [];
    case 'ok':
      if (msLeft <= DAY_MS) return [{ kind: 'expiring_1d', forDate }];
      if (msLeft <= 7 * DAY_MS) return [{ kind: 'expiring_7d', forDate }];
      return [];
    case 'grace':
      return [{ kind: 'grace_started', forDate }];
    case 'blocked': {
      if (access.reason !== 'trial_ended' && access.reason !== 'expired') return [];
      const sinceOffline = access.blockAt ? now.getTime() - access.blockAt.getTime() : Infinity;
      return sinceOffline <= OFFLINE_NOTICE_WINDOW_DAYS * DAY_MS
        ? [{ kind: 'menu_offline', forDate }]
        : [];
    }
    default:
      return [];
  }
}
