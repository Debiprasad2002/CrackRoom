/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light theme. Names keep their roles: 900 is the page, 800 the card surface, 850 the
        // sidebar and inputs, 700/600 raised chips and tracks, 500 hover borders.
        ink: {
          950: '#E8EBF2',
          900: '#F4F5F9',
          850: '#F9FAFC',
          800: '#FFFFFF',
          750: '#FAFAFD',
          700: '#EEF0F6',
          600: '#E3E7EF',
          500: '#C9D0DE',
        },
        line: { DEFAULT: '#E3E7EF', strong: '#D2D8E4' },
        fg: { DEFAULT: '#141A2E', muted: '#4A5470', subtle: '#646E89' },
        // Accent shades are used as text and fills on white, so the light numbers are the darker,
        // readable tones (300 is the text accent; 500 the primary button with white text).
        violet: {
          300: '#6D28D9',
          400: '#7C3AED',
          500: '#7C3AED',
          600: '#6D28D9',
          700: '#5B21B6',
        },
        cyan: { 300: '#0E7490', 400: '#0891B2' },
        mint: { 400: '#15803D' },
        amber: { 300: '#B45309', 400: '#D97706' },
        rose: { 400: '#E11D48' },
        // Subject identity — validated as a categorical set (CVD + normal vision); used for dots and marks.
        subj: { phy: '#169CB8', chem: '#C4861A', math: '#8B5CF6', bio: '#D9608F' },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', '"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem' },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -16px rgba(16,24,40,0.12)',
        pop: '0 2px 6px rgba(16,24,40,0.06), 0 24px 48px -16px rgba(16,24,40,0.22)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { shimmer: 'shimmer 1.6s infinite' },
    },
  },
  plugins: [],
};
