import CrmMessages from '@/components/crm/CrmMessages';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/server';
import { getAdminMessagesList } from '@/app/actions/clientActions';

/**
 * Page CRM Messages Clients.
 * Accessible à l'admin OU à tout personnel disposant de la permission
 * `can_follow_prospects` (mêmes permissions que l'onglet Clients).
 *
 * Depuis juillet 2026, c'est le SEUL point d'entrée pour la gestion
 * des messages clients. La page `/admin/publications` a été recentrée
 * sur la publication d'actualités/promotions uniquement.
 *
 * Cette route est partagée entre :
 *  - le shell `/crm` (utilisé par les commerciaux/techniciens), via
 *    l'onglet « Messages Clients » de `CrmShell` ;
 *  - le shell `/admin` (utilisé par les administrateurs), via l'entrée
 *    « CRM » de `AdminShell` qui pointe ici.
 */
export default async function CrmMessagesPage() {
  try {
    await requirePermission('can_follow_prospects');
  } catch {
    redirect('/login?callbackUrl=/crm/messages');
  }

  // Le service role client peut manquer en dev sans Supabase configuré :
  // on encapsule pour ne pas crasher le SSR.
  let initialClients: any[] = [];
  try {
    const res = await getAdminMessagesList();
    if (res.success) initialClients = res.clients;
  } catch {
    initialClients = [];
  }

  return <CrmMessages initialClients={initialClients} />;
}
