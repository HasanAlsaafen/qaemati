import { fromCents, lineKey, parseLineKey, toCents } from './order-lines';

describe('parseLineKey', () => {
  it('reads a plain dish, a size, extras, and both', () => {
    expect(parseLineKey('item1')).toEqual({ itemId: 'item1', variantId: null, addonIds: [] });
    expect(parseLineKey('item1:v1')).toEqual({ itemId: 'item1', variantId: 'v1', addonIds: [] });
    expect(parseLineKey('item1::b,a')).toEqual({
      itemId: 'item1',
      variantId: null,
      addonIds: ['a', 'b'],
    });
    expect(parseLineKey('item1:v1:b,a')).toEqual({
      itemId: 'item1',
      variantId: 'v1',
      addonIds: ['a', 'b'],
    });
  });

  it.each([
    '',
    ':v1',
    'a:b:c:d',
    'bad id',
    'a:b c',
    'a::x,x',
    'a::' + Array(21).fill('z').join(','),
    'a/../b',
    'x'.repeat(65),
  ])('refuses %p', (key) => {
    expect(parseLineKey(key)).toBeNull();
  });
});

describe('lineKey', () => {
  it('is the same for the same choice in any order', () => {
    expect(lineKey({ itemId: 'i', variantId: null, addonIds: ['b', 'a'] })).toBe('i::a,b');
    expect(lineKey({ itemId: 'i', variantId: 'v', addonIds: ['b', 'a'] })).toBe('i:v:a,b');
    expect(lineKey({ itemId: 'i', variantId: null, addonIds: [] })).toBe('i');
  });
});

describe('cents', () => {
  it('adds money without floating point drift', () => {
    expect(fromCents(toCents('0.10') + toCents('0.20'))).toBe('0.30');
    expect(fromCents(toCents(3.5) * 3)).toBe('10.50');
  });
});
