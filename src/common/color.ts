/**
 * WCAG contrast math, shared between scripts/check-contrast.ts (the
 * build-time palette gate from Phase 1) and A4's branding color picker
 * (which needs the same formula to block a restaurant-chosen primary
 * color that wouldn't pass AA against white, both live client-side and
 * re-validated server-side). One canonical implementation rather than
 * three copies drifting apart.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Returns null for anything that isn't a valid 6-digit hex color. */
export function hexToRgb(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const normalized = match[1];
  return {
    r: parseInt(normalized.substring(0, 2), 16),
    g: parseInt(normalized.substring(2, 4), 16),
    b: parseInt(normalized.substring(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** "R G B" space-separated triplet, the format every color token in
 *  src/styles/tokens.css is stored in (so Tailwind's
 *  rgb(var(--x) / <alpha-value>) opacity modifiers work). */
export function rgbToTriplet({ r, g, b }: Rgb): string {
  return `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export const WHITE: Rgb = { r: 255, g: 255, b: 255 };

/** A restaurant's chosen primary color must still read clearly as white
 *  button/badge text on top of it (the design system's `--color-on-
 *  primary` stays fixed white rather than flipping per-restaurant -- see
 *  A4's admin-labels/branding controller comments for why). 4.5:1 is the
 *  WCAG AA threshold for that text. */
export function meetsPrimaryColorContrast(rgb: Rgb): boolean {
  return contrastRatio(rgb, WHITE) >= 4.5;
}

/** A darker shade of the same hue for the hover state
 *  (--color-primary-hover), matching how the Zaytoun default pair
 *  relates (#44603C -> #365030, roughly a 20% darken). */
export function darken(rgb: Rgb, amount = 0.2): Rgb {
  return {
    r: rgb.r * (1 - amount),
    g: rgb.g * (1 - amount),
    b: rgb.b * (1 - amount),
  };
}

/** A soft tint of the same hue for --color-primary-soft (badge/chip
 *  backgrounds), by blending toward white. */
export function lighten(rgb: Rgb, amount = 0.85): Rgb {
  return {
    r: rgb.r + (255 - rgb.r) * amount,
    g: rgb.g + (255 - rgb.g) * amount,
    b: rgb.b + (255 - rgb.b) * amount,
  };
}
