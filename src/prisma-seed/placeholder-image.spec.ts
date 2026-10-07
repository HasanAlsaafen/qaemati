import { generateLogoPlaceholderSvg, generatePlaceholderSvg } from './placeholder-image';

describe('seed placeholder images', () => {
  it('are flat color, never a gradient', () => {
    for (const svg of [generatePlaceholderSvg('a'), generateLogoPlaceholderSvg('b')]) {
      expect(svg).not.toMatch(/gradient|url\(#/i);
    }
  });

  it('give the same image for the same seed and vary between seeds', () => {
    expect(generatePlaceholderSvg('x')).toBe(generatePlaceholderSvg('x'));
    const fills = new Set(
      Array.from(
        { length: 12 },
        (_, i) => /<rect[^>]*fill="(#[0-9A-F]{6})"/.exec(generatePlaceholderSvg(`s${i}`))?.[1],
      ),
    );
    expect(fills.size).toBeGreaterThan(1);
  });
});
