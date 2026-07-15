'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/shared/Navbar';

/**
 * Préfixes de routes « admin » : le bandeau (Navbar) du site public est
 * masqué sur ces segments car ils ont déjà leur propre shell
 * (`AdminShell` avec sidebar dédiée).
 *
 * Note : le Footer est rendu par le RootLayout (server component) après
 * ce wrapper, ce qui permet de conserver `import 'server-only'` dans
 * repositories.ts (utilisé par Footer pour getCompanyProfile).
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
    </>
  );
}