/** @type {import('tailwindcss').Config} */

/**
 * Tokens are stored in CSS as "R G B" triplets (see src/styles/tokens.css),
 * so wrapping them this way lets Tailwind's opacity modifiers (e.g.
 * bg-text/40) work, and lets a restaurant override a token at runtime by
 * setting the CSS variable without touching this config.
 */
function withOpacity(variable) {
  return `rgb(var(${variable}) / <alpha-value>)`;
}

module.exports = {
  content: ['./views/**/*.njk'],
  theme: {
    extend: {
      colors: {
        bg: withOpacity('--color-bg'),
        surface: withOpacity('--color-surface'),
        'muted-surface': withOpacity('--color-surface-muted'),
        border: withOpacity('--color-border'),
        'border-strong': withOpacity('--color-border-strong'),
        text: withOpacity('--color-text'),
        'muted-text': withOpacity('--color-text-muted'),
        primary: {
          DEFAULT: withOpacity('--color-primary'),
          hover: withOpacity('--color-primary-hover'),
          soft: withOpacity('--color-primary-soft'),
          on: withOpacity('--color-on-primary'),
        },
        secondary: {
          DEFAULT: withOpacity('--color-secondary'),
          text: withOpacity('--color-secondary-text'),
          soft: withOpacity('--color-secondary-soft'),
          on: withOpacity('--color-on-secondary'),
        },
        gold: withOpacity('--color-gold'),
        'on-gold': withOpacity('--color-on-gold'),
        success: withOpacity('--color-success'),
        warning: withOpacity('--color-warning'),
        danger: withOpacity('--color-danger'),
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
      },
      lineHeight: {
        body: 'var(--leading-body)',
        heading: 'var(--leading-heading)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        raised: 'var(--shadow-raised)',
        overlay: 'var(--shadow-overlay)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
      },
    },
  },
  plugins: [],
};
