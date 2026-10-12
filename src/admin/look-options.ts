/**
 * The choices a restaurant's look can take. Shared by a restaurant's own save,
 * the ready-made themes the platform owner edits, and their tests, so there is
 * one list to keep right.
 */
export const FONT_THEMES = new Set([
  'classic',
  'modern',
  'clean',
  'cairo',
  'almarai',
  'naskh',
  'serif',
]);
export const MENU_DENSITIES = new Set(['comfortable', 'compact', 'spacious']);
export const CORNER_STYLES = new Set(['rounded', 'sharp', 'soft']);
export const CARD_STYLES = new Set(['flat', 'raised', 'outlined', 'tinted']);
export const BUTTON_SHAPES = new Set(['rounded', 'pill', 'square']);
export const CATEGORY_DIVIDERS = new Set([
  'none',
  'line',
  'dashed',
  'dotted',
  'thick',
  'double',
  'fade',
  'ornament',
  'zigzag',
]);
export const BACKGROUND_STYLES = new Set(['solid', 'pattern', 'image']);
export const BACKGROUND_PATTERNS = new Set([
  'dots',
  'grid',
  'diagonal',
  'checks',
  'lines',
  'waves',
  'zigzag',
  'diamonds',
  'rings',
  'polka',
  'stripes',
]);
export const MENU_LAYOUTS = new Set(['grid', 'grid3', 'list', 'large']);
export const ITEM_IMAGE_MODES = new Set(['show', 'filled', 'hide']);
export const ITEM_IMAGE_SHAPES = new Set(['standard', 'wide', 'square', 'tall', 'round']);
export const CATEGORY_MARKERS = new Set(['none', 'bar', 'dot', 'square', 'rule', 'underline']);
export const LOGO_SHAPES = new Set(['rounded', 'round', 'square']);
export const COVER_HEIGHTS = new Set(['medium', 'small', 'large']);
export const PRICE_STYLES = new Set(['plain', 'badge', 'muted']);
export const HEADING_ALIGNS = new Set(['start', 'center']);
export const THEME_DECORS = new Set([
  'none',
  'ramadan',
  'eidFitr',
  'eidAdha',
  'olive',
  'summer',
  'winter',
  'evening',
]);
export const SECTION_SPACINGS = new Set(['cozy', 'comfortable', 'spacious']);
