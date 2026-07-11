import { listOrders } from '@/data/repositories';
import { MOCK_ORDER_ITEMS } from '@/data/mock';
import OrdersTable from '@/components/admin/OrdersTable';
import type { Order } from '@/types';

export default async function AdminCommandesPage() {
  const orders = await listOrders();

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

  return <OrdersTable initialOrders={enriched} />;
}
