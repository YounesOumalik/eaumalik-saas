import { listProducts } from '@/data/repositories';
import CatalogueManager from '@/components/admin/CatalogueManager';
import CataloguePdfManager from '@/components/admin/CataloguePdfManager';

export const dynamic = 'force-dynamic';

export default async function AdminCataloguePage() {
  const products = await listProducts({ includeArchived: true });
  return (
    <div className="space-y-8">
      {/* Gestionnaire du PDF catalogue (flipbook landing page).
          Réservé superadmin / administrateur — gate côté Server Action. */}
      <CataloguePdfManager />
      {/* Gestionnaire des produits (CRUD classique). */}
      <CatalogueManager initialProducts={products} />
    </div>
  );
}
