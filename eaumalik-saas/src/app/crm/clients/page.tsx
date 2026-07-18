import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/server';
import { listClientsForStaff, listOrdersForStaff, listMaintenance } from '@/data/repositories';
import { getAdminMessagesList } from '@/app/actions/clientActions';
import ClientList from '@/components/crm/ClientList';

/**
 * Page Fiches Clients — accessible à l'admin OU à tout personnel disposant
 * de la permission `can_follow_prospects`. Avant ce fix, la page exigeait
 * `requireAdmin()` ce qui forçait tout personnel non-admin à se reconnecter
 * dès qu'il cliquait sur l'onglet "Clients" dans le CRM (alors que l'UI
 * montrait bien l'onglet grâce aux permissions).
 *
 * On charge également la liste des conversations de messagerie (bouton
 * « Messages Clients » en haut de la page). Si l'utilisateur courant n'est
 * pas admin, `getAdminMessagesList` lèvera une erreur ; on retombe alors
 * gracieusement sur un tableau vide, ce qui masque simplement le badge de
 * notifications tout en laissant l'UI intacte pour le personnel autorisé à
 * voir les fiches mais pas la boîte de réception.
 */
export default async function CrmClientsPage() {
  try {
    await requirePermission('can_follow_prospects');
  } catch {
    redirect('/login?callbackUrl=/crm/clients');
  }

  const [clients, orders, maintenance, messagesRes] = await Promise.all([
    listClientsForStaff(),
    listOrdersForStaff(),
    listMaintenance(),
    // Encapsulé : `getAdminMessagesList` exige un rôle admin.
    getAdminMessagesList().catch(() => ({ success: false as const, clients: [] as any[] })),
  ]);

  const initialMessages = messagesRes.success ? messagesRes.clients : [];

  return (
    <ClientList
      initialClients={clients}
      allOrders={orders}
      allMaintenance={maintenance}
      initialMessages={initialMessages}
    />
  );
}
