/**
 * Verifies every text/background color pair in the Zaytoun palette meets
 * WCAG AA (4.5:1 for body text, 3:1 for large text / UI components).
 * Run with `npm run contrast:check`. Exits non-zero if anything fails.
 */

import { contrastRatio as sharedContrastRatio, hexToRgb } from '../src/common/color';

interface Pair {
  name: string;
  fg: string;
  bg: string;
  minRatio: 4.5 | 3;
  context: string;
}

const colors = {
  bg: '#F2F9FA',
  surface: '#FFFDFA',
  surfaceMuted: '#DCECEF',
  text: '#0F2A30',
  textMuted: '#4F6E75',
  primary: '#1565C0',
  primaryHover: '#0F52A0',
  primarySoft: '#E3EEFA',
  secondary: '#FF9800',
  secondaryText: '#9A5700',
  secondarySoft: '#FFF1DB',
  gold: '#E2B04A',
  onGold: '#0F2A30',
  success: '#2A7248',
  warning: '#A56716',
  warningText: '#7A480A',
  danger: '#B3382C',
  white: '#FFFFFF',
  borderStrong: '#6F8F98',
};


// Status messages are drawn as colored text on a 10% tint of the same color
// over the page background, which is lower contrast than text on white.
function tint(fgHex: string, bgHex: string, alpha = 0.1): string {
  const fg = hexToRgb(fgHex)!;
  const bg = hexToRgb(bgHex)!;
  const mix = (f: number, b: number) => Math.round(alpha * f + (1 - alpha) * b);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(fg.r, bg.r))}${toHex(mix(fg.g, bg.g))}${toHex(mix(fg.b, bg.b))}`;
}

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
    name: 'secondary-text / secondary-soft (badge/button)',
    fg: colors.secondaryText,
    bg: colors.secondarySoft,
    minRatio: 4.5,
    context: 'badge/button label',
  },
  {
    name: 'primary / primary-soft (badge/button)',
    fg: colors.primary,
    bg: colors.primarySoft,
    minRatio: 4.5,
    context: 'badge/button label',
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
  {
    name: 'success / success tint on bg (message)',
    fg: colors.success,
    bg: tint(colors.success, colors.bg),
    minRatio: 4.5,
    context: 'status message',
  },
  {
    name: 'danger / danger tint on bg (message)',
    fg: colors.danger,
    bg: tint(colors.danger, colors.bg),
    minRatio: 4.5,
    context: 'status message',
  },
  {
    name: 'warning-text / warning tint on bg (message)',
    fg: colors.warningText,
    bg: tint(colors.warning, colors.bg),
    minRatio: 4.5,
    context: 'status message',
  },
  {
    name: 'secondary-text / surface (404 label)',
    fg: colors.secondaryText,
    bg: colors.surface,
    minRatio: 4.5,
    context: 'small text',
  },
];

function contrastRatio(hexA: string, hexB: string): number {
  return sharedContrastRatio(hexToRgb(hexA)!, hexToRgb(hexB)!);
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
