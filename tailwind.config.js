/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./views/**/*.njk'],
  theme: {
    extend: {
      colors: {
        bg: '#FAF6EF',
        surface: '#FFFFFF',
        'muted-surface': '#F2EBDD',
        border: '#E6DCC9',
        text: '#2B2622',
        'muted-text': '#6B6258',
        primary: {
          DEFAULT: '#44603C',
          hover: '#365030',
          soft: '#E7EEDF',
        },
        secondary: {
          DEFAULT: '#C4622D',
          text: '#A8501F',
          soft: '#F7E3D6',
        },
        gold: '#E2B04A',
        success: '#2E7D4F',
        warning: '#B7791F',
        danger: '#B3382C',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
      },
    },
  },
  plugins: [],
};
