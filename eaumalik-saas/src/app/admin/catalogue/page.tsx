import { listProducts } from '@/data/repositories';
import CatalogueManager from '@/components/admin/CatalogueManager';

export const dynamic = 'force-dynamic';

export default async function AdminCataloguePage() {
  const products = await listProducts({ includeArchived: true });
  return <CatalogueManager initialProducts={products} />;
}
