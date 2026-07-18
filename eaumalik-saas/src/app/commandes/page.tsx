import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { requireUser } from '@/lib/supabase/server';
import { listClientsForStaff, listOrdersForStaff } from '@/data/repositories';
import OrdersView from '@/components/shared/OrdersView';
import { effectivePermissions } from '@/lib/supabase/server';
import { MOCK_ORDER_ITEMS } from '@/data/mock';
import type { Order } from '@/types';

/**
 * Page UNIFIÉE « Suivi des Commandes ».
 *
 * Accessible à tout personnel (admin OU commercial/technicien…) ayant au moins
 * l'une des permissions :
 *   - can_validate_orders    → valider / faire avancer / annuler une commande
 *   - can_follow_prospects   → simple suivi (lecture seule des actions)
 *
 * Cette route est désormais l'unique entrée du personnel pour le suivi des
 * commandes. Elle est exposée depuis la barre de navigation principale via
 * l'entrée « Commandes » du menu « Administration ». Les anciennes routes
 * `/admin` (Commandes admin) et `/crm/commandes` (Suivi Commandes CRM)
 * redirigent désormais vers `/commandes` pour éviter les doublons d'URL.
 *
 * La garde combine les deux permissions : on accepte si l'une OU l'autre est
 * vraie. Un commercial pur (can_follow_prospects) voit le suivi mais ne peut
 * pas valider (gating UI dans OrdersView via `canValidate`).
 */
export default async function CommandesPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    const from = headers().get('x-crm-pathname') || '/commandes';
    redirect(`/login?callbackUrl=${encodeURIComponent(from)}`);
  }

  const perms = effectivePermissions(user);
  if (!perms.can_validate_orders && !perms.can_follow_prospects) {
    redirect('/');
  }

  const [clients, orders] = await Promise.all([listClientsForStaff(), listOrdersForStaff()]);

  // Jointure items (selon la forme retournée par mock ou Supabase)
  const itemsByOrder = new Map<string, typeof MOCK_ORDER_ITEMS>();
  MOCK_ORDER_ITEMS.forEach(i => {
    const arr = itemsByOrder.get(i.order_id) ?? [];
    arr.push(i);
    itemsByOrder.set(i.order_id, arr);
  });

  const enriched: Order[] = orders.map(o => ({
    ...o,
    items: (o as any).items ?? itemsByOrder.get(o.id) ?? [],
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <OrdersView initialOrders={enriched} clients={clients} />
    </div>
  );
}
