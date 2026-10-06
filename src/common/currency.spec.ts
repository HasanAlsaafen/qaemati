import { currencySymbol } from './currency';

describe('currencySymbol', () => {
  it('uses the shekel sign for ILS in both languages', () => {
    expect(currencySymbol('ILS', 'en')).toBe('₪');
    expect(currencySymbol('ILS', 'ar')).toBe('₪');
  });

  it('uses the dollar sign for USD', () => {
    expect(currencySymbol('USD', 'en')).toBe('$');
  });

  it('keeps the code when there is no short symbol', () => {
    expect(currencySymbol('JOD', 'en')).toBe('JOD');
  });

  it('strips direction marks from right to left symbols', () => {
    expect(currencySymbol('JOD', 'ar')).not.toMatch(/[‎‏؜]/);
  });

  it('falls back to the code for something that is not a currency', () => {
    expect(currencySymbol('not-a-code', 'en')).toBe('not-a-code');
  });
});
