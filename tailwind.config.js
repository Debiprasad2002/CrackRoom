const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const shades = (name, steps) => Object.fromEntries(steps.map((step) => [step, token(`${name}-${step}`)]));

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Values live in index.css so the light and dark themes swap them. Names keep their roles:
        // 900 is the page, 800 the card surface, 850 the sidebar and inputs, 700/600 raised chips
        // and tracks, 500 hover borders. Accent 300 is the text accent, 500 the primary button.
        ink: shades('ink', [950, 900, 850, 800, 750, 700, 600, 500]),
        line: { DEFAULT: token('line'), strong: token('line-strong') },
        fg: { DEFAULT: token('fg'), muted: token('fg-muted'), subtle: token('fg-subtle') },
        violet: shades('violet', [300, 400, 500, 600, 700]),
        cyan: shades('cyan', [300, 400]),
        mint: shades('mint', [400]),
        amber: shades('amber', [300, 400]),
        rose: shades('rose', [400]),
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
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { shimmer: 'shimmer 1.6s infinite' },
    },
  },
  plugins: [],
};
