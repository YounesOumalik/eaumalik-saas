'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/shared/Navbar';
import Footer from '@/components/shared/Footer';

/**
 * Préfixes de routes « admin » : le bandeau (Navbar) et le pied de page
 * (Footer) du site public sont masqués sur ces segments car ils ont
 * déjà leur propre shell (`AdminShell` avec sidebar dédiée).
 *
 * Toute route commençant par l'un de ces préfixes est considérée comme
 * une route d'administration.
 */
const ADMIN_PATH_PREFIXES = ['/admin', '/crm', '/commandes'] as const;

function isAdminPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return ADMIN_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = isAdminPath(pathname);

  if (hideChrome) {
    // Routes admin : on laisse passer les enfants sans le bandeau public.
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-16">{children}</main>
      <Footer />
    </>
  );
}