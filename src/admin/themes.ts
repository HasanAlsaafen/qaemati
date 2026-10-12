import {
  hexToRgb,
  meetsBackgroundContrast,
  meetsPrimaryColorContrast,
  meetsSecondaryColorContrast,
} from '../common/color';
import {
  BACKGROUND_PATTERNS,
  BUTTON_SHAPES,
  CARD_STYLES,
  CATEGORY_DIVIDERS,
  CATEGORY_MARKERS,
  CORNER_STYLES,
  FONT_THEMES,
  HEADING_ALIGNS,
  PRICE_STYLES,
  THEME_DECORS,
} from './look-options';

/**
 * Ready-made looks the owner can start from (a season, an occasion). A theme is
 * only a set of values for settings that already exist: choosing one fills the
 * branding form, the owner sees it in the live preview, can change anything, and
 * saves through the normal, validated save. A theme never touches the logo,
 * cover, dish photos, layout or density, so the restaurant's own content and
 * structure stay as they are. The platform owner edits the themes (BrandTheme).
 */
export interface ThemeValues {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontTheme: string;
  cornerStyle: string;
  cardStyle: string;
  buttonShape: string;
  categoryDivider: string;
  categoryMarker: string;
  headingAlign: string;
  priceStyle: string;
  backgroundStyle: string;
  backgroundPattern: string;
  themeDecor: string;
}

/** The choices a theme field may take, keyed by the field. */
const CHOICES: Record<Exclude<keyof ThemeValues, `${string}Color`>, Set<string>> = {
  fontTheme: FONT_THEMES,
  cornerStyle: CORNER_STYLES,
  cardStyle: CARD_STYLES,
  buttonShape: BUTTON_SHAPES,
  categoryDivider: CATEGORY_DIVIDERS,
  categoryMarker: CATEGORY_MARKERS,
  headingAlign: HEADING_ALIGNS,
  priceStyle: PRICE_STYLES,
  // A theme paints a color or a pattern. A photo background is the owner's own.
  backgroundStyle: new Set(['solid', 'pattern']),
  backgroundPattern: BACKGROUND_PATTERNS,
  themeDecor: THEME_DECORS,
};

export const THEME_CHOICE_FIELDS = Object.keys(CHOICES) as (keyof typeof CHOICES)[];
export const THEME_COLOR_FIELDS = ['primaryColor', 'secondaryColor', 'backgroundColor'] as const;

export function themeChoices(field: keyof typeof CHOICES): string[] {
  return [...CHOICES[field]];
}

export interface ThemeProblem {
  field: string;
  /** Key under `super.errors` in the locale files. */
  key: 'invalidColor' | 'colorContrast' | 'invalidOption';
}

/**
 * The first thing wrong with a theme's values, or null. The same rules a restaurant's own
 * save applies, so a theme can never put a restaurant on a look the save would refuse.
 */
export function checkThemeValues(values: ThemeValues): ThemeProblem | null {
  const rules = [
    ['primaryColor', meetsPrimaryColorContrast],
    ['secondaryColor', meetsSecondaryColorContrast],
    ['backgroundColor', meetsBackgroundContrast],
  ] as const;
  for (const [field, passes] of rules) {
    const rgb = /^#[0-9a-fA-F]{6}$/.test(values[field]) ? hexToRgb(values[field]) : null;
    if (!rgb) return { field, key: 'invalidColor' };
    if (!passes(rgb)) return { field, key: 'colorContrast' };
  }
  for (const field of THEME_CHOICE_FIELDS) {
    if (!CHOICES[field].has(values[field])) return { field, key: 'invalidOption' };
  }
  return null;
}

/** What the browser needs: the settings keyed the way the branding form names them. */
export function themesForForm(
  rows: ({ key: string } & ThemeValues)[],
): Record<string, Record<string, string>> {
  return Object.fromEntries(
    rows.map(({ key, primaryColor, ...rest }) => {
      const values: Record<string, string> = { color: primaryColor };
      for (const field of [...THEME_CHOICE_FIELDS, 'secondaryColor', 'backgroundColor'] as const) {
        values[field] = rest[field];
      }
      return [key, values];
    }),
  );
}
