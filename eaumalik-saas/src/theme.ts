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
    primary: '#0891b2',
    primaryLight: '#22d3ee',
    primaryDark: '#0e7490',
    accent: '#06b6d4',
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
