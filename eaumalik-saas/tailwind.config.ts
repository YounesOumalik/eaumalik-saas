import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        // Sky (océan) — direction prise le 2026-07-14.
        primary: {
          50:  '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc',
          400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1',
          800: '#075985', 900: '#0c4a6e', 950: '#082f49',
        },
        navy: {
          950: '#020617', 900: '#0a0f1e', 800: '#0f172a',
          700: '#1e293b', 600: '#334155',
        },
        /**
         * "brand" — alias de la palette sky (océan). Les composants existants
         * utilisent `bg-brand-*`/`text-brand-*` pour leurs accents. On garde
         * le nom pour ne pas tout réécrire, mais les valeurs pointent vers
         * la palette sky (océan) désormais.
         */
        brand: {
          50:'#f0f9ff',100:'#e0f2fe',200:'#bae6fd',300:'#7dd3fc',
          400:'#38bdf8',500:'#0ea5e9',600:'#0284c7',700:'#0369a1',
          800:'#075985',900:'#0c4a6e',
        },
        /** "ocean" — nom sémantique propre pour les nouveaux composants (= brand). */
        ocean: {
          50:'#f0f9ff',100:'#e0f2fe',200:'#bae6fd',300:'#7dd3fc',
          400:'#38bdf8',500:'#0ea5e9',600:'#0284c7',700:'#0369a1',
          800:'#075985',900:'#0c4a6e',950:'#082f49',
        },
        cream: '#FDFCF8',
        savor: '#F3EFE0',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        body: ['Space Grotesk', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      keyframes: {
        'wave-move': { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        'toast-in': { from: { opacity: '0', transform: 'translateX(60px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        'modal-in': { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
        pulse: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        shimmer: { '0%': { 'background-position': '-200% 0' }, '100%': { 'background-position': '200% 0' } },
        'fade-in-up': { from: { opacity: '0', transform: 'translateY(30px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'water-drop': { '0%': { transform: 'translateY(-20px) scale(0.8)', opacity: '0' }, '30%': { opacity: '1' }, '100%': { transform: 'translateY(60px) scale(0.3)', opacity: '0' } },
        'flow-down': { '0%': { transform: 'translateY(-10px)', opacity: '0' }, '50%': { opacity: '1' }, '100%': { transform: 'translateY(10px)', opacity: '0' } },
        'pulse-glow': { '0%,100%': { 'box-shadow': '0 0 10px rgba(20,184,166,0.2)' }, '50%': { 'box-shadow': '0 0 25px rgba(20,184,166,0.5)' } },
        'sun-rotate': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        'moon-tilt': { '0%,100%': { transform: 'rotate(0)' }, '50%': { transform: 'rotate(15deg)' } },
      },
      animation: {
        'wave-move': 'wave-move 12s linear infinite',
        'toast-in':  'toast-in 0.35s ease',
        'modal-in':  'modal-in 0.25s ease',
        pulse:       'pulse 2s infinite',
        shimmer:     'shimmer 2s infinite',
        'fade-in-up':'fade-in-up 0.8s cubic-bezier(0.16,1,0.3,1) forwards',
        'water-drop':'water-drop 2s infinite ease-in',
        'flow-down': 'flow-down 1.5s infinite ease-in-out',
        'pulse-glow':'pulse-glow 2s infinite ease-in-out',
        'sun-rotate':'sun-rotate 12s linear infinite',
        'moon-tilt': 'moon-tilt 4s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
