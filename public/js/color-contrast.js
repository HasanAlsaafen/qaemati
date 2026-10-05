// Mirrors src/common/color.ts's hexToRgb/contrastRatio/meetsPrimaryColorContrast
// -- see that file for the tested canonical version and open-status.js's
// precedent for this duplication (no bundler in this stack to share one
// module between server and browser).
//
// Used by the branding page's primary color picker to give instant
// pass/fail feedback as the owner drags the picker, before the form is
// ever submitted. RestaurantService re-checks the same rule server-side
// -- this client copy is a UX convenience, not the enforcement point.
(function () {
  function hexToRgb(hex) {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!match) return null;
    const normalized = match[1];
    return {
      r: parseInt(normalized.substring(0, 2), 16),
      g: parseInt(normalized.substring(2, 4), 16),
      b: parseInt(normalized.substring(4, 6), 16),
    };
  }

  function relativeLuminance(rgb) {
    function channel(value) {
      const srgb = value / 255;
      return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  }

  function contrastRatio(rgbA, rgbB) {
    const lumA = relativeLuminance(rgbA);
    const lumB = relativeLuminance(rgbB);
    const lighter = Math.max(lumA, lumB);
    const darker = Math.min(lumA, lumB);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function darken(rgb, amount) {
    return { r: rgb.r * (1 - amount), g: rgb.g * (1 - amount), b: rgb.b * (1 - amount) };
  }

  function lighten(rgb, amount) {
    return {
      r: rgb.r + (255 - rgb.r) * amount,
      g: rgb.g + (255 - rgb.g) * amount,
      b: rgb.b + (255 - rgb.b) * amount,
    };
  }

  window.checkPrimaryColorContrast = function (hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    const ratio = contrastRatio(rgb, { r: 255, g: 255, b: 255 });
    return { ratio: ratio, passes: ratio >= 4.5 };
  };

  // Mirrors src/common/color.ts's toSecondaryPalette/meetsSecondaryColorContrast:
  // this app never puts white text on a solid secondary background, only a
  // darker text variant on a soft tint of the same hue, so the check that
  // matters is secondaryText-against-secondarySoft, not against white.
  window.checkSecondaryColorContrast = function (hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    const text = darken(rgb, 0.35);
    const soft = lighten(rgb, 0.85);
    const ratio = contrastRatio(text, soft);
    return { ratio: ratio, passes: ratio >= 4.5 };
  };
})();
