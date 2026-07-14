/**
 * Palette extraite du logo EAUMALIK + config globale.
 * Ces variables sont répliquées dans globals.css et tailwind.config.ts.
 */
export const theme = {
  company: {
    name: 'EAUMALIK SARL',
    legal: 'EAUMALIK S.A.R.L.',
    capital: 100000,
    address: '23 Rue Boured Eig 3, N5 Roches Noires, Casablanca',
    phone: '+212 661 463 194',
    altPhone: '066 072 07 59',
    fax: '0520927192',
    email: 'eaumaliksarl@gmail.com',
  },
  colors: {
    // Palette "Bleu océan" (sky Tailwind) — direction prise le 2026-07-14.
    primary: '#0284c7',
    primaryLight: '#38bdf8',
    primaryDark: '#075985',
    accent: '#0ea5e9',
    danger: '#ef4444',
    warning: '#f59e0b',
    success: '#10b981',
  },
  fonts: {
    display: "'Outfit', sans-serif",
    body: "'Space Grotesk', sans-serif",
  },
} as const;

export type Theme = typeof theme;
