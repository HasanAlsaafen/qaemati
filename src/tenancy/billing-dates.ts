/**
 * Adds whole months in UTC and clamps to the last day of the target month,
 * so 31 January plus one month is 28 (or 29) February and not 3 March.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function addInterval(date: Date, interval: 'MONTHLY' | 'YEARLY', periods: number): Date {
  return addMonths(date, (interval === 'YEARLY' ? 12 : 1) * periods);
}

/**
 * The period a payment covers. It starts where the paid up time ends, or at
 * the payment date when the subscription already lapsed, so paying early never
 * wastes days and paying late never gives free ones.
 */
export function nextPeriod(
  currentPeriodEnd: Date | null,
  paidAt: Date,
  interval: 'MONTHLY' | 'YEARLY',
  periods: number,
): { start: Date; end: Date } {
  const start = currentPeriodEnd && currentPeriodEnd > paidAt ? currentPeriodEnd : paidAt;
  return { start, end: addInterval(start, interval, periods) };
}
