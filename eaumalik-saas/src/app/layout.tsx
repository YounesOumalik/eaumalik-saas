import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/shared/Providers';
import Navbar from '@/components/shared/Navbar';
import Footer from '@/components/shared/Footer';

export const metadata: Metadata = {
  title: 'EAUMALIK SARL — Solutions de Traitement et Purification de l\'Eau',
  description:
    'EAUMALIK SARL - Purificateurs d\'eau, osmose inverse, stations industrielles. Installation professionnelle au Maroc. L\'eau pure, une vie plus saine.',
  authors: [{ name: 'EAUMALIK SARL' }],
  keywords: ['purificateur eau', 'osmose inverse', 'traitement eau', 'Maroc', 'Casablanca', 'EAUMALIK'],
  openGraph: {
    title: 'EAUMALIK SARL — L\'eau pure, une vie plus saine',
    description: 'Solutions professionnelles de traitement et purification de l\'eau au Maroc.',
    type: 'website',
    locale: 'fr_MA',
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
