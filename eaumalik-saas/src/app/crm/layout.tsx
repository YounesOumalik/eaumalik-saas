import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { requireUser } from '@/lib/supabase/server';
import AdminShell from '@/components/admin/AdminShell';

/**
 * Garde du segment /crm/* : exige simplement un utilisateur authentifie.
 * Le rôle admin n'est plus requis à ce niveau : les permissions fines
 * sont vérifiées par chaque page (clients, messages, news, maintenance).
 * Cela permet à un compte personnel non-admin (sales, technician…) ayant
 * la permission `can_follow_prospects` ou `can_edit_products` d'accéder
 * aux onglets autorisés sans être renvoyé vers /login.
 *
 * Depuis juillet 2026 les routes /crm/* partagent désormais le même
 * `AdminShell` (barre latérale principale) que `/admin/*` et `/commandes`.
 * Le sous-shell `CrmShell` (Maintenance / Clients / Messages) a été
 * supprimé : l'entrée « Clients » est directement visible dans la barre
 * latérale principale, et le segment CRM n'apparaît plus comme une
 * catégorie dédiée du menu.
 *
 * Le middleware Next.js bloque déjà tout accès non authentifié ; on garde
 * un filet de sécurité serveur ici (le cookie peut theoriquement être
 * présent mais invalide côté Supabase).
 */
export default async function CrmLayout({ children }: { children: ReactNode }) {
  try {
    await requireUser();
  } catch {
    // On recupere le pathname reel depuis le middleware pour fabriquer un
    // callbackUrl précis (sinon l'utilisateur serait ramené à `/crm` au lieu
    // de `/crm/clients` après reconnexion).
    const from = headers().get('x-crm-pathname') || '/crm';
    redirect(`/login?callbackUrl=${encodeURIComponent(from)}`);
  }
  return <AdminShell title="Administration">{children}</AdminShell>;
}
