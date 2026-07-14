import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/supabase/server';
import { listNews } from '@/data/repositories';
import PublicationsManager from '@/components/admin/PublicationsManager';

/**
 * Page `/admin/publications` — accessible uniquement aux administrateurs.
 *
 * Permet de composer, modifier, archiver et supprimer des actualités /
 * promotions. La réponse aux messages clients a été déplacée dans la
 * section CRM (`/crm/messages`) en juillet 2026.
 *
 * Implémentation :
 *  - Server component : charge la liste initiale (`listNews` avec
 *    `includeArchived = true`) pour que la page s'affiche même sans
 *    appel client supplémentaire. En cas d'erreur de lecture (mode
 *    dégradé, env manquante…), on retombe sur un tableau vide plutôt
 *    que de bloquer l'accès à l'admin.
 *  - Client component (`PublicationsManager`) : gère l'UI (onglets,
 *    édition, archivage, suppression) et se resynchronise en local.
 */
export const dynamic = 'force-dynamic';

export default async function AdminPublicationsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect('/login?callbackUrl=/admin/publications');
  }

  // Charge la liste complète (actives + archivées) côté serveur.
  // En cas d'échec (mode mock corrompu, etc.), on retombe sur [] :
  // l'admin pourra toujours publier ; la liste se rechargera à la
  // prochaine action.
  let initialNews: Awaited<ReturnType<typeof listNews>> = [];
  try {
    initialNews = await listNews({ includeArchived: true });
  } catch {
    initialNews = [];
  }

  return <PublicationsManager initialNews={initialNews} />;
}
