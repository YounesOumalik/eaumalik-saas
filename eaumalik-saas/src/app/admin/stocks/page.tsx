import { listAllRestockHistory, listProducts, listLocations, listProductLocationStock } from '@/data/repositories';
import StocksDashboard from '@/components/admin/StocksDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminStocksPage() {
  // Récupère les données réelles. Les promesses sont tolérantes aux erreurs :
  // si le repo locations/stock échoue (migration pas encore appliquée), on
  // retombe sur [] pour ne pas casser la page stocks existante.
  const [products, history, locations, stockByLocation] = await Promise.all([
    listProducts({ includeArchived: true }),
    listAllRestockHistory(90).catch(() => []),
    listLocations({ includeArchived: true }).catch(() => []),
    listProductLocationStock().catch(() => []),
  ]);
  return (
    <StocksDashboard
      products={products}
      history={history}
      locations={locations}
      stockByLocation={stockByLocation}
    />
  );
}