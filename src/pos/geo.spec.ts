import { checkLocation, distanceMeters } from './geo';

const restaurant = { lat: 31.9522, lng: 35.2332 };
const rule = { center: restaurant, radiusMeters: 150, enabled: true };
// About 0.00009 degrees of latitude is 10 meters.
const north = (meters: number) => ({ lat: restaurant.lat + meters / 111_320, lng: restaurant.lng });

describe('distanceMeters', () => {
  it('is zero for the same point and about 111 km per degree of latitude', () => {
    expect(distanceMeters(restaurant, restaurant)).toBe(0);
    expect(distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -2);
  });

  it('shrinks east to west with latitude', () => {
    const equator = distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    const jerusalem = distanceMeters({ lat: 31.95, lng: 0 }, { lat: 31.95, lng: 1 });
    expect(jerusalem).toBeLessThan(equator * 0.9);
  });
});

describe('checkLocation', () => {
  it('lets a guest inside the radius order and reports the distance', () => {
    const verdict = checkLocation(rule, north(40));
    expect(verdict.ok).toBe(true);
    expect(verdict.ok && verdict.distance).toBeGreaterThanOrEqual(39);
  });

  it('refuses a guest outside the radius', () => {
    expect(checkLocation(rule, north(400))).toMatchObject({ ok: false, reason: 'too_far' });
  });

  it('lets the phone accuracy widen the circle, but only a little', () => {
    expect(checkLocation(rule, { ...north(220), accuracy: 80 }).ok).toBe(true);
    expect(checkLocation(rule, { ...north(300), accuracy: 900 })).toMatchObject({
      ok: false,
      reason: 'too_far',
    });
  });

  it('refuses a fix too vague to mean anything', () => {
    expect(checkLocation(rule, { ...north(10), accuracy: 5000 })).toMatchObject({
      ok: false,
      reason: 'location_inaccurate',
    });
  });

  it.each([
    [{}],
    [{ lat: 31.9 }],
    [{ lat: NaN, lng: 35 }],
    [{ lat: 120, lng: 35 }],
    [{ lat: 31.9, lng: 400 }],
  ])('asks for a real position when given %p', (guest) => {
    expect(checkLocation(rule, guest)).toMatchObject({ ok: false, reason: 'location_required' });
  });

  it('decides nothing when the check is off or the restaurant has no position', () => {
    expect(checkLocation({ ...rule, enabled: false }, {})).toEqual({ ok: true, distance: null });
    expect(checkLocation({ ...rule, center: null }, {})).toEqual({ ok: true, distance: null });
  });
});
