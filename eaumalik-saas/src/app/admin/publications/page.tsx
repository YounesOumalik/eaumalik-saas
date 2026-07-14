import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/supabase/server';
import PublicationsManager from '@/components/admin/PublicationsManager';

/**
 * Page `/admin/publications` — accessible uniquement aux administrateurs.
 *
 * Permet de composer et publier des actualités / promotions.
 *
 * Depuis juillet 2026, la réponse aux messages des clients a été
 * déplacée dans la section CRM (`/crm/messages`) ; elle n'est plus
 * accessible depuis cette page.
 *
 * Implémentation :
 *  - Le server component se contente de vérifier l'accès admin.
 *  - Le composant client ne dépend d'AUCUNE action Supabase côté
 *    serveur → la page s'affiche même en mode dégradé (env var
 *    `SUPABASE_SERVICE_ROLE_KEY` manquante).
 *
 * Migrée dans la section Administration à la demande utilisateur
 * (juillet 2026) — voir `PublicationsManager.tsx`.
 */
export const dynamic = 'force-dynamic';

export default async function AdminPublicationsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect('/login?callbackUrl=/admin/publications');
  }

  // Aucun appel Supabase ici : on délègue tout au composant client
  // pour qu'un éventuel problème d'env var n'empêche pas l'affichage
  // de l'onglet « Publier ».
  return <PublicationsManager />;
}
