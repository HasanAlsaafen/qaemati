import { checkThemeValues, themesForForm, ThemeValues } from './themes';

const good: ThemeValues = {
  primaryColor: '#2E3A87',
  secondaryColor: '#C9971C',
  backgroundColor: '#FFF9EC',
  fontTheme: 'naskh',
  cornerStyle: 'soft',
  cardStyle: 'outlined',
  buttonShape: 'pill',
  categoryDivider: 'ornament',
  categoryMarker: 'rule',
  headingAlign: 'center',
  priceStyle: 'badge',
  backgroundStyle: 'pattern',
  backgroundPattern: 'diamonds',
  themeDecor: 'ramadan',
};

describe('checking a theme', () => {
  it('accepts a valid one', () => {
    expect(checkThemeValues(good)).toBeNull();
  });

  it.each([
    ['primaryColor', 'blue', 'invalidColor'],
    ['primaryColor', '#FFEB3B', 'colorContrast'],
    ['secondaryColor', '#12345', 'invalidColor'],
    ['backgroundColor', '#111111', 'colorContrast'],
    ['fontTheme', 'comic', 'invalidOption'],
    ['cornerStyle', 'round', 'invalidOption'],
    ['categoryDivider', 'squiggle', 'invalidOption'],
    ['backgroundPattern', 'plaid', 'invalidOption'],
    ['themeDecor', 'unicorns', 'invalidOption'],
    ['backgroundStyle', 'image', 'invalidOption'],
  ])('refuses %s = %s (%s)', (field, value, key) => {
    expect(checkThemeValues({ ...good, [field]: value })).toEqual({ field, key });
  });
});

describe('themes for the branding form', () => {
  it('names the primary color the way the form does and keeps only the look', () => {
    const forForm = themesForForm([{ key: 'ramadan', ...good }]);
    expect(forForm.ramadan.color).toBe('#2E3A87');
    expect(forForm.ramadan).not.toHaveProperty('primaryColor');
    expect(forForm.ramadan).not.toHaveProperty('key');
    expect(forForm.ramadan.themeDecor).toBe('ramadan');
  });
});
