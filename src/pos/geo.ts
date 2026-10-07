const EARTH_RADIUS_METERS = 6_371_000;
/** A phone's own accuracy estimate is allowed to widen the circle, up to this much. */
const MAX_ACCURACY_ALLOWANCE = 100;
/** A fix this vague says nothing useful about where the guest is. */
const MAX_USABLE_ACCURACY = 1000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great circle distance between two points, in meters. */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type LocationVerdict =
  | { ok: true; distance: number | null }
  | {
      ok: false;
      reason: 'location_required' | 'location_inaccurate' | 'too_far';
      distance?: number;
    };

export interface LocationRule {
  /** The restaurant's position, or null when the owner has not set it. */
  center: { lat: number; lng: number } | null;
  radiusMeters: number;
  enabled: boolean;
}

export interface GuestPosition {
  lat?: number;
  lng?: number;
  accuracy?: number;
}

const valid = (lat: number | undefined, lng: number | undefined): lat is number =>
  typeof lat === 'number' &&
  typeof lng === 'number' &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180;

/**
 * Is the guest at the restaurant. With the check off, or no position set for
 * the restaurant, nothing can be decided and the answer is yes (the POS page
 * tells the owner to set a position). The phone's accuracy estimate widens
 * the circle a little, since indoors a fix is often off by tens of meters.
 */
export function checkLocation(rule: LocationRule, guest: GuestPosition): LocationVerdict {
  if (!rule.enabled || !rule.center) return { ok: true, distance: null };
  if (!valid(guest.lat, guest.lng)) return { ok: false, reason: 'location_required' };
  const accuracy = Math.max(0, Number(guest.accuracy ?? 0));
  if (!Number.isFinite(accuracy) || accuracy > MAX_USABLE_ACCURACY) {
    return { ok: false, reason: 'location_inaccurate' };
  }
  const distance = Math.round(
    distanceMeters(rule.center, { lat: guest.lat, lng: guest.lng as number }),
  );
  const allowed = rule.radiusMeters + Math.min(accuracy, MAX_ACCURACY_ALLOWANCE);
  return distance <= allowed ? { ok: true, distance } : { ok: false, reason: 'too_far', distance };
}
