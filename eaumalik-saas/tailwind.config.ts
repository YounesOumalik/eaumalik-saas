import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        primary: {
          50:  '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9',
          400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490',
          800: '#155e75', 900: '#164e63', 950: '#083344',
        },
        navy: {
          950: '#020617', 900: '#0a0f1e', 800: '#0f172a',
          700: '#1e293b', 600: '#334155',
        },
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['Space Grotesk', 'sans-serif'],
      },
      keyframes: {
        'wave-move': { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        'toast-in': { from: { opacity: '0', transform: 'translateX(60px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        'modal-in': { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
        pulse: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
      },
      animation: {
        'wave-move': 'wave-move 12s linear infinite',
        'toast-in':  'toast-in 0.35s ease',
        'modal-in':  'modal-in 0.25s ease',
        pulse:       'pulse 2s infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
