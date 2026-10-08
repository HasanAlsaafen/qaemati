/**
 * A3: computes whether a restaurant is open right now from a single daily
 * "HH:MM"-"HH:MM" range (see the schema comment on Restaurant.openTime),
 * and when it opens/closes next. Pure function of minutes-since-midnight,
 * so it works the same whether "now" comes from the server clock
 * (menu.service.ts, already in Asia/Hebron via computeNowInHebron) or the
 * client's ticking status badge (public/js/open-status.js, which mirrors
 * this file the same way normalize-search-text.ts/menu.js do).
 */
export interface OpenStatus {
  isOpen: boolean;
  /** "HH:MM" of the next close (if open) or next open (if closed). */
  nextChangeTime: string;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function computeOpenStatus(
  openTime: string,
  closeTime: string,
  nowMinutes: number,
): OpenStatus {
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);

  // Same-day range (e.g. 07:00-23:00): open while open <= now < close.
  // Overnight range (e.g. 20:00-02:00, close <= open): open while
  // now >= open OR now < close.
  const isOvernight = close <= open;
  const isOpen = isOvernight
    ? nowMinutes >= open || nowMinutes < close
    : nowMinutes >= open && nowMinutes < close;

  return {
    isOpen,
    nextChangeTime: isOpen ? closeTime : openTime,
  };
}

/**
 * A3: is a category's availability window currently open? Same-day only
 * (not overnight-aware like computeOpenStatus) -- a category window like
 * "Breakfast 07:00-11:00" realistically never spans midnight, so this
 * stays simpler than the restaurant-hours case on purpose.
 */
export function isCategoryAvailableNow(
  availableFrom: string | null,
  availableTo: string | null,
  nowMinutes: number,
): boolean {
  if (!availableFrom || !availableTo) return true;
  const from = toMinutes(availableFrom);
  const to = toMinutes(availableTo);
  return nowMinutes >= from && nowMinutes < to;
}

/** Current time in Asia/Hebron as minutes-since-midnight, for the server
 *  render path. The client-side mirror uses the browser's own Date in
 *  whatever timezone it's in, which is a deliberate difference, not a
 *  bug -- see public/js/open-status.js's comment. */
export function nowInHebronMinutes(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Hebron',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

/** A menu with no hours is always served. */
export function isMenuServingNow(
  menu: { availableFrom: string | null; availableTo: string | null },
  nowMinutes: number,
): boolean {
  if (!menu.availableFrom || !menu.availableTo) return true;
  return computeOpenStatus(menu.availableFrom, menu.availableTo, nowMinutes).isOpen;
}
