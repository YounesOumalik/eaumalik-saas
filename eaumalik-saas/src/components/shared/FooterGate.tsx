import { headers } from 'next/headers';
import Footer from './Footer';

const ADMIN_PATH_PREFIXES = ['/admin', '/crm', '/commandes'] as const;

/**
 * Server Component : affiche le Footer public UNIQUEMENT si la route
 * courante n'est pas une route admin/crm/commandes.
 *
 * Utilise le header `x-pathname` posé par le middleware (cf. src/middleware.ts).
 * Le Footer est lui-même un Server Component (async, fait un fetch Supabase
 * via `getCompanyProfile`) et ne peut donc pas être importé depuis un
 * Client Component comme SiteChrome.
 */
export default function FooterGate() {
  const pathname = headers().get('x-pathname') ?? '';
  const isAdmin = ADMIN_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (isAdmin) return null;
  return <Footer />;
}