import { listOrders } from '@/data/repositories';
import ComptabiliteDashboard from '@/components/admin/ComptabiliteDashboard';

export default async function AdminComptabilitePage() {
  const orders = await listOrders();
  return <ComptabiliteDashboard orders={orders} />;
}
