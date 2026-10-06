import { isWeakSecret, validateEnv } from './env.validation';

const strong = 'a-long-random-value-0123456789';
const base = { DATABASE_URL: 'postgresql://x', NODE_ENV: 'production' };

describe('validateEnv', () => {
  it('accepts a complete production configuration', () => {
    expect(() =>
      validateEnv({ ...base, SESSION_SECRET: strong, CSRF_SECRET: `${strong}-2` }),
    ).not.toThrow();
  });

  it.each([
    ['missing', undefined],
    ['placeholder', 'change-me-in-production'],
    ['too short', 'short'],
  ])('refuses production when SESSION_SECRET is %s', (_label, value) => {
    expect(() => validateEnv({ ...base, SESSION_SECRET: value, CSRF_SECRET: strong })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it('refuses production when CSRF_SECRET is still the placeholder', () => {
    expect(() =>
      validateEnv({ ...base, SESSION_SECRET: strong, CSRF_SECRET: 'change-me-in-production' }),
    ).toThrow(/CSRF_SECRET/);
  });

  it('refuses a missing DATABASE_URL in every environment', () => {
    expect(() => validateEnv({ NODE_ENV: 'development' })).toThrow(/DATABASE_URL/);
  });

  it('only warns about weak secrets outside production', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: 'x', NODE_ENV: 'development', SESSION_SECRET: 'change-me' }),
    ).not.toThrow();
  });

  it('rejects an unknown DEFAULT_LOCALE', () => {
    expect(() => validateEnv({ DATABASE_URL: 'x', DEFAULT_LOCALE: 'fr' })).toThrow(
      /DEFAULT_LOCALE/,
    );
  });

  it('flags weak values', () => {
    expect(isWeakSecret(undefined)).toBe(true);
    expect(isWeakSecret(strong)).toBe(false);
  });
});
