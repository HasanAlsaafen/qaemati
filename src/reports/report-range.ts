export type Preset = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface ReportRange {
  /** Inclusive dates, yyyy-mm-dd, in the restaurant's own day. */
  from: string;
  to: string;
  preset: Preset;
}

export const MAX_DAYS = 366;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const PRESET_DAYS: Record<Exclude<Preset, 'custom'>, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

/** Today's date where the restaurant is, whatever the server clock's zone. */
export function todayInHebron(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hebron' }).format(now);
}

const toUtc = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const toIso = (date: Date): string => date.toISOString().slice(0, 10);

export function addDaysIso(iso: string, days: number): string {
  const date = toUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/** A real calendar date, so 2026-02-31 is refused rather than turned into March. */
export function isRealDate(value: unknown): value is string {
  return typeof value === 'string' && ISO.test(value) && toIso(toUtc(value)) === value;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000) + 1;
}

export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDaysIso(day, 1)) days.push(day);
  return days;
}

/**
 * What the query string asks for, or the last 7 days when it asks for nothing
 * usable. A custom range must be two real dates in order and within a year, so
 * nobody can ask the database to scan everything.
 */
export function parseRange(
  query: { range?: unknown; from?: unknown; to?: unknown },
  today: string,
): ReportRange {
  const preset = query.range;
  if (typeof preset === 'string' && preset in PRESET_DAYS) {
    const days = PRESET_DAYS[preset as keyof typeof PRESET_DAYS];
    return { from: addDaysIso(today, -(days - 1)), to: today, preset: preset as Preset };
  }
  if (isRealDate(query.from) && isRealDate(query.to) && query.from <= query.to) {
    if (daysBetween(query.from, query.to) <= MAX_DAYS) {
      return { from: query.from, to: query.to, preset: 'custom' };
    }
  }
  return { from: addDaysIso(today, -6), to: today, preset: '7d' };
}
