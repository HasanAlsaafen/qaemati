import { normalizeSearchText } from './normalize-search-text';

describe('normalizeSearchText', () => {
  it('strips Arabic diacritics', () => {
    expect(normalizeSearchText('قَهْوَة')).toBe(normalizeSearchText('قهوة'));
  });

  it('folds alef variants to a bare alef', () => {
    expect(normalizeSearchText('أحمد')).toBe(normalizeSearchText('احمد'));
    expect(normalizeSearchText('إحمد')).toBe(normalizeSearchText('احمد'));
    expect(normalizeSearchText('آحمد')).toBe(normalizeSearchText('احمد'));
  });

  it('folds taa marbuta to haa', () => {
    expect(normalizeSearchText('قهوة')).toBe(normalizeSearchText('قهوه'));
  });

  it('folds alef maksura to yaa', () => {
    expect(normalizeSearchText('مقهى')).toBe(normalizeSearchText('مقهي'));
  });

  it('lowercases Latin text', () => {
    expect(normalizeSearchText('Arabic Coffee')).toBe('arabic coffee');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeSearchText('  latte  ')).toBe('latte');
  });

  it('is idempotent on already-normalized input', () => {
    const normalized = normalizeSearchText('قهوة عربية');
    expect(normalizeSearchText(normalized)).toBe(normalized);
  });
});
