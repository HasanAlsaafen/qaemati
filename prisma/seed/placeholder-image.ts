/**
 * Generates a deterministic gradient SVG placeholder for seed data, so demo
 * items and restaurant logos never depend on real (and possibly
 * copyrighted) photography. Same input string always produces the same
 * gradient, so re-running the seed produces identical output.
 */

const GRADIENT_PAIRS: [string, string][] = [
  ['#44603C', '#6B8F5E'], // primary olive
  ['#C4622D', '#E08A52'], // secondary terracotta
  ['#A8501F', '#C4622D'], // secondary-text to secondary
  ['#E2B04A', '#F0CC80'], // gold
  ['#365030', '#44603C'], // primary-hover to primary
  ['#2E7D4F', '#52A374'], // success
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function generatePlaceholderSvg(seed: string, label?: string): string {
  const pair = GRADIENT_PAIRS[hashString(seed) % GRADIENT_PAIRS.length];
  const [from, to] = pair;
  const angle = hashString(seed + 'angle') % 360;
  const initial = (label ?? seed).trim().charAt(0).toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0%" stop-color="${from}" />
      <stop offset="100%" stop-color="${to}" />
    </linearGradient>
  </defs>
  <rect width="480" height="480" fill="url(#g)" />
  <circle cx="240" cy="240" r="150" fill="#FFFFFF" fill-opacity="0.08" />
  <text x="240" y="265" font-family="sans-serif" font-size="140" font-weight="700" fill="#FFFFFF" fill-opacity="0.35" text-anchor="middle">${initial}</text>
</svg>`;
}
