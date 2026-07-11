import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/shared/Providers';
import Navbar from '@/components/shared/Navbar';
import Footer from '@/components/shared/Footer';

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
  openGraph: {
    title: "EAUMALIK SARL — L'eau pure, une vie plus saine",
    description: "Solutions professionnelles de traitement et purification de l'eau au Maroc. Osmose inverse et filtres à eau.",
    type: 'website',
    locale: 'fr_MA',
    siteName: 'EAUMALIK SARL',
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
    <html lang="fr" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body>
        <Providers>
          <Navbar />
          <main className="min-h-screen pt-16">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
