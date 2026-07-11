import { listProducts } from '@/data/repositories';
import StockTable from '@/components/admin/StockTable';

export default async function AdminStocksPage() {
  const products = await listProducts();
  return <StockTable initialProducts={products} />;
}
