import { parseOptions } from './items.controller';

describe('parseOptions', () => {
  it('parses indexed form fields into an option list', () => {
    const raw = {
      '0': { nameAr: 'صغير', nameEn: 'Small', price: '10' },
      '1': { nameAr: 'كبير', nameEn: 'Large', price: '15' },
    };
    expect(parseOptions(raw)).toEqual([
      { nameAr: 'صغير', nameEn: 'Small', price: 10 },
      { nameAr: 'كبير', nameEn: 'Large', price: 15 },
    ]);
  });

  it('drops a row with no name on either side (an empty trailing "add row")', () => {
    const raw = {
      '0': { nameAr: '', nameEn: '', price: '5' },
      '1': { nameAr: 'Valid', nameEn: 'Valid', price: '5' },
    };
    expect(parseOptions(raw)).toEqual([{ nameAr: 'Valid', nameEn: 'Valid', price: 5 }]);
  });

  it('keeps a row with only one name filled in', () => {
    const raw = { '0': { nameAr: 'فقط عربي', nameEn: '', price: '3' } };
    expect(parseOptions(raw)).toEqual([{ nameAr: 'فقط عربي', nameEn: '', price: 3 }]);
  });

  it('defaults a missing or invalid price to 0', () => {
    const raw = { '0': { nameAr: 'X', nameEn: 'X', price: undefined } };
    expect(parseOptions(raw)).toEqual([{ nameAr: 'X', nameEn: 'X', price: 0 }]);
  });

  it('rejects a negative price', () => {
    const raw = { '0': { nameAr: 'X', nameEn: 'X', price: '-5' } };
    expect(parseOptions(raw)).toEqual([{ nameAr: 'X', nameEn: 'X', price: 0 }]);
  });

  it('trims whitespace from names', () => {
    const raw = { '0': { nameAr: '  صغير  ', nameEn: '  Small  ', price: '10' } };
    expect(parseOptions(raw)).toEqual([{ nameAr: 'صغير', nameEn: 'Small', price: 10 }]);
  });

  it('returns an empty array for missing or non-object input', () => {
    expect(parseOptions(undefined)).toEqual([]);
    expect(parseOptions(null)).toEqual([]);
    expect(parseOptions('not an object')).toEqual([]);
  });
});
