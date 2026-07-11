import { listOrders, listProducts } from '@/data/repositories';
import ComptabiliteDashboard from '@/components/admin/ComptabiliteDashboard';

export default async function AdminComptabilitePage() {
  const orders = await listOrders();
  const products = await listProducts();
  return <ComptabiliteDashboard orders={orders} products={products} />;
}
