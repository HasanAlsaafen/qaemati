/**
 * Verifies every text/background color pair in the Zaytoun palette meets
 * WCAG AA (4.5:1 for body text, 3:1 for large text / UI components).
 * Run with `npm run contrast:check`. Exits non-zero if anything fails.
 */

interface Pair {
  name: string;
  fg: string;
  bg: string;
  minRatio: 4.5 | 3;
  context: string;
}

const colors = {
  bg: '#FAF6EF',
  surface: '#FFFFFF',
  surfaceMuted: '#F2EBDD',
  text: '#2B2622',
  textMuted: '#6B6258',
  primary: '#44603C',
  primaryHover: '#365030',
  secondary: '#C4622D',
  secondaryText: '#A8501F',
  gold: '#E2B04A',
  onGold: '#2B2622',
  success: '#2E7D4F',
  warning: '#A56716',
  danger: '#B3382C',
  white: '#FFFFFF',
  borderStrong: '#9C927F',
};

const pairs: Pair[] = [
  { name: 'text / bg', fg: colors.text, bg: colors.bg, minRatio: 4.5, context: 'body text' },
  {
    name: 'text / surface',
    fg: colors.text,
    bg: colors.surface,
    minRatio: 4.5,
    context: 'body text',
  },
  {
    name: 'text-muted / bg',
    fg: colors.textMuted,
    bg: colors.bg,
    minRatio: 4.5,
    context: 'body text',
  },
  {
    name: 'text-muted / surface',
    fg: colors.textMuted,
    bg: colors.surface,
    minRatio: 4.5,
    context: 'body text',
  },
  {
    name: 'text / surface-muted',
    fg: colors.text,
    bg: colors.surfaceMuted,
    minRatio: 4.5,
    context: 'body text',
  },
  {
    name: 'white / primary (button)',
    fg: colors.white,
    bg: colors.primary,
    minRatio: 4.5,
    context: 'button label',
  },
  {
    name: 'white / primary-hover (button)',
    fg: colors.white,
    bg: colors.primaryHover,
    minRatio: 4.5,
    context: 'button label',
  },
  {
    name: 'white / secondary-text (button)',
    fg: colors.white,
    bg: colors.secondaryText,
    minRatio: 4.5,
    context: 'button label',
  },
  {
    name: 'secondary-text / bg (link/small text)',
    fg: colors.secondaryText,
    bg: colors.bg,
    minRatio: 4.5,
    context: 'small text',
  },
  {
    name: 'secondary-text / surface (link/small text)',
    fg: colors.secondaryText,
    bg: colors.surface,
    minRatio: 4.5,
    context: 'small text',
  },
  {
    name: 'on-gold / gold (popular badge)',
    fg: colors.onGold,
    bg: colors.gold,
    minRatio: 4.5,
    context: 'badge text',
  },
  {
    name: 'white / success (status)',
    fg: colors.white,
    bg: colors.success,
    minRatio: 4.5,
    context: 'status label',
  },
  {
    name: 'white / warning (status)',
    fg: colors.white,
    bg: colors.warning,
    minRatio: 4.5,
    context: 'status label',
  },
  {
    name: 'white / danger (status)',
    fg: colors.white,
    bg: colors.danger,
    minRatio: 4.5,
    context: 'status label',
  },
  {
    name: 'primary / bg (large heading accent)',
    fg: colors.primary,
    bg: colors.bg,
    minRatio: 3,
    context: 'large text',
  },
  {
    name: 'border-strong / surface (input outline)',
    fg: colors.borderStrong,
    bg: colors.surface,
    minRatio: 3,
    context: 'interactive UI boundary',
  },
];

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  return [r, g, b];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  const [rl, gl, bl] = [channel(r), channel(g), channel(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexToRgb(hexA));
  const lumB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

let hasFailure = false;

console.log('Zaytoun palette contrast check (WCAG AA)\n');

for (const pair of pairs) {
  const ratio = contrastRatio(pair.fg, pair.bg);
  const passed = ratio >= pair.minRatio;
  if (!passed) hasFailure = true;

  const status = passed ? 'PASS' : 'FAIL';
  console.log(
    `[${status}] ${pair.name.padEnd(40)} ${ratio.toFixed(2)}:1  (needs ${pair.minRatio}:1, ${pair.context})`,
  );
}

console.log('');

if (hasFailure) {
  console.error('One or more color pairs fail WCAG AA. Adjust the palette in src/styles/tokens.css.');
  process.exit(1);
} else {
  console.log('All color pairs meet WCAG AA.');
}
