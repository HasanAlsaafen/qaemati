import { SubscriptionFacts } from '../tenancy/tenant-access';
import { dayOf, planNotices } from './notice-rules';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-20T09:00:00Z');
const at = (days: number) => new Date(now.getTime() + days * DAY);
const active = (days: number, extra: Partial<SubscriptionFacts> = {}): SubscriptionFacts => ({
  status: 'ACTIVE',
  trialEndsAt: null,
  currentPeriodEnd: at(days),
  graceDays: 7,
  ...extra,
});
const trial = (days: number): SubscriptionFacts => ({
  status: 'TRIALING',
  trialEndsAt: at(days),
  currentPeriodEnd: null,
  graceDays: 7,
});
const kinds = (facts: SubscriptionFacts) => planNotices(facts, now).map((n) => n.kind);

describe('planNotices', () => {
  it('says nothing while there is plenty of time', () => {
    expect(kinds(active(30))).toEqual([]);
    expect(kinds(active(7.5))).toEqual([]);
    expect(kinds(trial(10))).toEqual([]);
  });

  it('reminds within 7 days, and within a day sends only the more urgent one', () => {
    expect(kinds(active(6))).toEqual(['expiring_7d']);
    expect(kinds(active(7))).toEqual(['expiring_7d']);
    expect(kinds(active(2))).toEqual(['expiring_7d']);
    expect(kinds(active(1))).toEqual(['expiring_1d']);
    expect(kinds(active(0.2))).toEqual(['expiring_1d']);
  });

  it('reminds a trial in its last three days', () => {
    expect(kinds(trial(3))).toEqual(['trial_ending']);
    expect(kinds(trial(0.5))).toEqual(['trial_ending']);
    expect(kinds(trial(4))).toEqual([]);
  });

  it('says the grace period began once the end has passed, then that the menu is offline', () => {
    expect(kinds(active(-1))).toEqual(['grace_started']);
    expect(kinds(active(-6.9))).toEqual(['grace_started']);
    expect(kinds(active(-8))).toEqual(['menu_offline']);
    expect(kinds({ ...trial(-1) })).toEqual(['grace_started']);
    expect(kinds({ ...trial(-9) })).toEqual(['menu_offline']);
  });

  it('stops writing to a menu that has been offline a long time', () => {
    expect(kinds(active(-7 - 13))).toEqual(['menu_offline']);
    expect(kinds(active(-7 - 15))).toEqual([]);
  });

  it('says nothing for an operator suspension or cancellation, or when nothing ever ends', () => {
    expect(kinds(active(-20, { status: 'SUSPENDED' }))).toEqual([]);
    expect(kinds(active(-20, { status: 'CANCELED' }))).toEqual([]);
    expect(
      kinds({ status: 'ACTIVE', trialEndsAt: null, currentPeriodEnd: null, graceDays: 7 }),
    ).toEqual([]);
  });

  it('keys the notice by the day the period ends, so a renewal starts a fresh set', () => {
    const first = planNotices(active(5), now)[0];
    const renewed = planNotices(active(5, { currentPeriodEnd: at(35) }), at(33))[0];
    expect(dayOf(first.forDate).getTime()).toBe(first.forDate.getTime());
    expect(renewed.forDate.getTime()).not.toBe(first.forDate.getTime());
  });

  it('respects a longer grace period', () => {
    expect(kinds(active(-10, { graceDays: 14 }))).toEqual(['grace_started']);
  });
});
