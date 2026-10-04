import {
  contrastRatio,
  darken,
  hexToRgb,
  lighten,
  meetsPrimaryColorContrast,
  relativeLuminance,
  rgbToHex,
  rgbToTriplet,
  WHITE,
} from './color';

describe('hexToRgb', () => {
  it('parses a 6-digit hex color', () => {
    expect(hexToRgb('#44603C')).toEqual({ r: 0x44, g: 0x60, b: 0x3c });
  });

  it('accepts a hex color without the leading #', () => {
    expect(hexToRgb('44603C')).toEqual({ r: 0x44, g: 0x60, b: 0x3c });
  });

  it('is case-insensitive', () => {
    expect(hexToRgb('#44603c')).toEqual(hexToRgb('#44603C'));
  });

  it('returns null for an invalid color', () => {
    expect(hexToRgb('not-a-color')).toBeNull();
    expect(hexToRgb('#fff')).toBeNull(); // 3-digit shorthand not supported
    expect(hexToRgb('#gggggg')).toBeNull();
  });
});

describe('rgbToHex / rgbToTriplet', () => {
  it('round-trips through hex', () => {
    const rgb = hexToRgb('#44603C')!;
    expect(rgbToHex(rgb)).toBe('#44603c');
  });

  it('formats as a space-separated triplet matching tokens.css', () => {
    expect(rgbToTriplet({ r: 68, g: 96, b: 60 })).toBe('68 96 60');
  });
});

describe('contrastRatio / relativeLuminance', () => {
  it('gives white against white a ratio of 1', () => {
    expect(contrastRatio(WHITE, WHITE)).toBeCloseTo(1, 2);
  });

  it('gives black against white the maximum ratio of 21', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, WHITE)).toBeCloseTo(21, 0);
  });

  it('matches the known contrast ratio of the Zaytoun primary against white', () => {
    // #44603C vs #FFFFFF is independently verified by
    // scripts/check-contrast.ts (used in every phase's "Verified"
    // section) to pass AA at >4.5:1.
    const ratio = contrastRatio(hexToRgb('#44603C')!, WHITE);
    expect(ratio).toBeGreaterThan(4.5);
  });

  it('white has the maximum possible luminance', () => {
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 2);
  });
});

describe('meetsPrimaryColorContrast', () => {
  it('accepts the existing Zaytoun primary color', () => {
    expect(meetsPrimaryColorContrast(hexToRgb('#44603C')!)).toBe(true);
  });

  it('rejects a light pastel color that would fail white text', () => {
    expect(meetsPrimaryColorContrast(hexToRgb('#FFD1A9')!)).toBe(false);
  });

  it('rejects white itself', () => {
    expect(meetsPrimaryColorContrast(WHITE)).toBe(false);
  });

  it('accepts black', () => {
    expect(meetsPrimaryColorContrast({ r: 0, g: 0, b: 0 })).toBe(true);
  });
});

describe('darken / lighten', () => {
  it('darken reduces every channel', () => {
    const rgb = { r: 100, g: 100, b: 100 };
    const darker = darken(rgb, 0.2);
    expect(darker.r).toBeLessThan(rgb.r);
    expect(darker.g).toBeLessThan(rgb.g);
    expect(darker.b).toBeLessThan(rgb.b);
  });

  it('lighten moves every channel toward 255', () => {
    const rgb = { r: 100, g: 100, b: 100 };
    const lighter = lighten(rgb, 0.5);
    expect(lighter.r).toBeGreaterThan(rgb.r);
    expect(lighter.r).toBeLessThan(255);
  });

  it('darken never produces a negative channel', () => {
    const darker = darken({ r: 10, g: 10, b: 10 }, 0.9);
    expect(darker.r).toBeGreaterThanOrEqual(0);
  });
});
