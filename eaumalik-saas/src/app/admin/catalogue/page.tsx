import { listProducts } from '@/data/repositories';
import CatalogueManager from '@/components/admin/CatalogueManager';

export default async function AdminCataloguePage() {
  const products = await listProducts();
  return <CatalogueManager initialProducts={products} />;
}
