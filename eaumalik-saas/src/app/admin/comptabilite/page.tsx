import { listOrdersForStaff, listProducts } from '@/data/repositories';
import ComptabiliteDashboard from '@/components/admin/ComptabiliteDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminComptabilitePage() {
  const orders = await listOrdersForStaff();
  const products = await listProducts();
  return <ComptabiliteDashboard orders={orders} products={products} />;
}
