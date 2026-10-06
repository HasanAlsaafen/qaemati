import { isValidFacebook, isValidMapUrl, isValidPhone, toFacebookUrl, toTelUrl } from './contact';

describe('contact helpers', () => {
  it.each(['+970 2 222 0111', '02-222-0111', '+97022220111', '(02) 2220111'])(
    'accepts phone %p',
    (value) => expect(isValidPhone(value)).toBe(true),
  );

  it.each(['abc', '12', 'call me', '+', '++97022220111'])('rejects phone %p', (value) =>
    expect(isValidPhone(value)).toBe(false),
  );

  it('keeps only dialable characters in the tel link', () => {
    expect(toTelUrl('+970 (2) 222-0111')).toBe('tel:+97022220111');
  });

  it.each(['haddoota', 'my.cafe_1', 'https://www.facebook.com/haddoota', 'https://fb.com/x/'])(
    'accepts facebook %p',
    (value) => expect(isValidFacebook(value)).toBe(true),
  );

  it.each([
    'ab',
    'two words',
    'http://facebook.com/x',
    'https://evil.example/facebook.com',
    'javascript:alert(1)',
  ])('rejects facebook %p', (value) => expect(isValidFacebook(value)).toBe(false));

  it('turns a handle into a page url and leaves a full url alone', () => {
    expect(toFacebookUrl('haddoota')).toBe('https://facebook.com/haddoota');
    expect(toFacebookUrl('https://www.facebook.com/haddoota')).toBe(
      'https://www.facebook.com/haddoota',
    );
  });

  it('only accepts https map links', () => {
    expect(isValidMapUrl('https://maps.app.goo.gl/abc')).toBe(true);
    expect(isValidMapUrl('http://maps.example/x')).toBe(false);
    expect(isValidMapUrl('javascript:alert(1)')).toBe(false);
    expect(isValidMapUrl('not a url')).toBe(false);
  });
});
