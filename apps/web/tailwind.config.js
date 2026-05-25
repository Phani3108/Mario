/** @type {import('tailwindcss').Config} */
export default {
  // Enable `dark:` variants when <html> carries the .dark class
  // (set by our useTheme hook).
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mario: {
          saffron: {
            50:  '#FFF8EC',
            100: '#FDEBC4',
            300: '#F5C063',
            400: '#F0A731',
            500: '#E97300',
            600: '#C95B00',
            700: '#9A4500',
          },
          slate: {
            50:  '#F4F6FA',
            100: '#E2E8F0',
            500: '#475569',
            700: '#1E293B',
            900: '#0F172A',
            950: '#080D17',
          },
          bone:  '#F8F5EE',
          lime:  '#84CC16',
          ink:   '#0B1220',
        },
      },
      fontFamily: {
        serif: ['"Source Serif Pro"', '"Source Serif 4"', 'Georgia', 'serif'],
        sans:  ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        blueprint: '0 1px 0 rgba(255,255,255,0.04) inset, 0 18px 40px -16px rgba(233,115,0,0.35)',
        elevated:  '0 24px 60px -28px rgba(15,23,42,0.6)',
      },
      backgroundImage: {
        'blueprint-grid':
          "linear-gradient(rgba(245,192,99,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(245,192,99,0.06) 1px, transparent 1px)",
      },
      backgroundSize: {
        blueprint: '32px 32px',
      },
    },
  },
  plugins: [],
};
