import { buildRestaurantJsonLd, getBaseUrl, serializeJsonLd, toAbsoluteUrl } from './seo';

const req = { protocol: 'https', get: () => 'menu.example.test' } as never;

describe('seo helpers', () => {
  afterEach(() => {
    delete process.env.PUBLIC_BASE_URL;
  });

  it('builds the base url from the request when nothing is configured', () => {
    expect(getBaseUrl(req)).toBe('https://menu.example.test');
  });

  it('prefers PUBLIC_BASE_URL and trims trailing slashes', () => {
    process.env.PUBLIC_BASE_URL = 'https://qaemati.app//';
    expect(getBaseUrl(req)).toBe('https://qaemati.app');
  });

  it('makes relative paths absolute and leaves absolute ones alone', () => {
    expect(toAbsoluteUrl('https://a.test', '/uploads/x.png')).toBe('https://a.test/uploads/x.png');
    expect(toAbsoluteUrl('https://a.test', 'https://cdn.test/x.png')).toBe(
      'https://cdn.test/x.png',
    );
    expect(toAbsoluteUrl('https://a.test', null)).toBeNull();
  });

  it('escapes < so json-ld cannot close its script tag', () => {
    expect(serializeJsonLd({ name: '</script><b>' })).not.toContain('</script>');
  });

  it('omits optional json-ld fields that are empty', () => {
    const data = JSON.parse(
      buildRestaurantJsonLd({
        name: 'A',
        description: null,
        url: 'https://a.test/m/a',
        imageUrl: null,
        menuUrl: 'https://a.test/m/a',
        telephone: null,
        address: null,
        sameAs: [],
      }),
    );
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: 'A',
      url: 'https://a.test/m/a',
      hasMenu: 'https://a.test/m/a',
    });
  });

  it('includes address and every social profile when present', () => {
    const data = JSON.parse(
      buildRestaurantJsonLd({
        name: 'A',
        description: null,
        url: 'https://a.test/m/a',
        imageUrl: null,
        menuUrl: 'https://a.test/m/a',
        telephone: '+97022220111',
        address: 'Hebron, Bridge Area',
        sameAs: ['https://instagram.com/a', 'https://facebook.com/a'],
      }),
    );
    expect(data.address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: 'Hebron, Bridge Area',
    });
    expect(data.sameAs).toHaveLength(2);
    expect(data.telephone).toBe('+97022220111');
  });
});
