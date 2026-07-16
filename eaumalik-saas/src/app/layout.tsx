import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/shared/Providers';
import SiteChrome from '@/components/shared/SiteChrome';
import FooterGate from '@/components/shared/FooterGate';

export const metadata: Metadata = {
  title: {
    default: 'EAUMALIK SARL — Traitement, Purification et Osmose Inverse au Maroc',
    template: '%s | EAUMALIK SARL',
  },
  description:
    "EAUMALIK SARL est le leader au Maroc de la purification d'eau et des systèmes d'osmose inverse. Profitez d'une eau pure, d'adoucisseurs et de filtres performants à domicile ou en industrie.",
  authors: [{ name: 'EAUMALIK SARL' }],
  keywords: [
    'eau',
    "purification d'eau",
    'osmose inverse',
    'filtre à eau',
    'adoucisseur',
    'traitement eau',
    'purificateur',
    'eau saine',
    'Maroc',
    'Casablanca',
    'EAUMALIK'
  ],
  // Icons auto-découverts via `app/icon.png` (32x32) et `app/apple-icon.png` (180x180).
  // On peut omettre `icons` ici : Next.js génère les balises <link rel="icon"> et
  // <link rel="apple-touch-icon"> à partir des fichiers présents dans `app/`.
  // Open Graph image : logo PNG (téléchargeable depuis le repo)
  openGraph: {
    title: "EAUMALIK SARL — L'eau pure, une vie plus saine",
    description: "Solutions professionnelles de traitement et purification de l'eau au Maroc. Osmose inverse et filtres à eau.",
    type: 'website',
    locale: 'fr_MA',
    siteName: 'EAUMALIK SARL',
    images: [
      {
        url: '/logo.png',
        width: 1440,
        height: 1440,
        alt: 'EAUMALIK SARL — Captage, traitement et distribution d\'eau',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "EAUMALIK SARL — L'eau pure, une vie plus saine",
    description: "Solutions professionnelles de traitement et purification de l'eau au Maroc.",
    images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600;700;800;900&family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossOrigin="anonymous" referrerPolicy="no-referrer" />
        {/* Script anti-flash : pose data-theme (et .dark) avant le premier paint
            pour éviter le flash blanc/noir au chargement.
            Stratégie : préférence stockée > prefers-color-scheme > sombre. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='eaumalik_theme',s=localStorage.getItem(k);var t=s;if(t!=='light'&&t!=='dark'){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark';}document.documentElement.setAttribute('data-theme',t);if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body>
        <Providers>
          <SiteChrome>{children}</SiteChrome>
          <FooterGate />
        </Providers>
      </body>
    </html>
  );
}
