import { listAllRestockHistory, listProducts } from '@/data/repositories';
import StocksDashboard from '@/components/admin/StocksDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminStocksPage() {
  const [products, history] = await Promise.all([
    listProducts({ includeArchived: true }),
    listAllRestockHistory(90).catch(() => []),
  ]);
  return <StocksDashboard products={products} history={history} />;
}
