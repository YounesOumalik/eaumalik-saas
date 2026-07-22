import { listProducts } from '@/data/repositories';
import { toAdminProduct } from '@/lib/public-media';
import CatalogueManager from '@/components/admin/CatalogueManager';
import CataloguePdfManager from '@/components/admin/CataloguePdfManager';

export const dynamic = 'force-dynamic';

export default async function AdminCataloguePage() {
  const products = await listProducts({ includeArchived: true });
  // Ne jamais sérialiser les images Base64 dans le payload RSC de l'admin :
  // elles sont servies séparément et mises en cache par /api/media.
  const catalogueProducts = products.map(toAdminProduct);
  return (
    <div className="space-y-8">
      {/* Gestionnaire du PDF catalogue (flipbook landing page).
          Réservé superadmin / administrateur — gate côté Server Action. */}
      <CataloguePdfManager />
      {/* Gestionnaire des produits (CRUD classique). */}
      <CatalogueManager initialProducts={catalogueProducts} />
    </div>
  );
}
