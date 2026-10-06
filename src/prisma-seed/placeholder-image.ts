/**
 * Generates a deterministic gradient SVG placeholder for seed data, so demo
 * items and restaurant logos never depend on real (and possibly
 * copyrighted) photography. Same input string always produces the same
 * gradient, so re-running the seed produces identical output.
 */

const GRADIENT_PAIRS: [string, string][] = [
  ['#1565C0', '#4A8FD8'], // primary blue
  ['#07808D', '#3FB0BD'], // teal
  ['#9A5700', '#E58A00'], // secondary-text to a deeper orange
  ['#E2B04A', '#F0CC80'], // gold
  ['#0F52A0', '#1565C0'], // primary-hover to primary
  ['#2E7D4F', '#52A374'], // success
];

// Material Symbols "restaurant" glyph (fork and knife), 24x24 viewBox,
// Apache-2.0 licensed. Used as a generic dish motif instead of a plain
// initial letter, which read as a placeholder rather than a menu photo.
const DISH_ICON_PATH =
  'M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 ' +
  '1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 ' +
  '14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z';

// A simple house/storefront glyph (Material Symbols "storefront", simplified),
// used for restaurant logo placeholders so they read as "a place" rather
// than a dish.
const STOREFRONT_ICON_PATH =
  'M4 4h16l1.5 5c.3 1.2-.6 2.3-1.8 2.3-1 0-1.9-.7-2.1-1.7L17 7h-2l.4 3.3c.1 1-.7 1.9-1.7 1.9s-1.8-.9-1.7-1.9L12.4 ' +
  '7h-0.8l-.4 3.3c-.1 1-.9 1.9-1.7 1.9s-1.8-.9-1.7-1.9L8.2 7H6.8l-.6 2.6c-.2 1-1.1 1.7-2.1 1.7-1.2 0-2.1-1.1-1.8-2.3L4 4z' +
  'm1.5 8.9c.6.4 1.3.6 2 .6.9 0 1.8-.3 2.5-.9.7.6 1.6.9 2.5.9s1.8-.3 2.5-.9c.7.6 1.6.9 2.5.9.7 0 1.4-.2 2-.6V19c0 .6-.4 1-1 1H6.5c-.6 0-1-.4-1-1v-6.1z';

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildSvg(seed: string, iconPath: string, iconScale: number): string {
  const pair = GRADIENT_PAIRS[hashString(seed) % GRADIENT_PAIRS.length];
  const [from, to] = pair;
  const angle = hashString(seed + 'angle') % 360;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0%" stop-color="${from}" />
      <stop offset="100%" stop-color="${to}" />
    </linearGradient>
  </defs>
  <rect width="480" height="480" fill="url(#g)" />
  <circle cx="240" cy="240" r="170" fill="#FFFFFF" fill-opacity="0.1" />
  <circle cx="240" cy="240" r="170" fill="none" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="2" />
  <g transform="translate(240,240) scale(${iconScale}) translate(-12,-12)" fill="#FFFFFF" fill-opacity="0.55">
    <path d="${iconPath}" />
  </g>
</svg>`;
}

export function generatePlaceholderSvg(seed: string): string {
  return buildSvg(seed, DISH_ICON_PATH, 4.6);
}

export function generateLogoPlaceholderSvg(seed: string): string {
  return buildSvg(seed, STOREFRONT_ICON_PATH, 4.6);
}
