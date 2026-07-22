import { getCachedPublicProducts, getCachedPublicPromotions } from '@/data/publicCatalog';
import BoutiqueClient from './BoutiqueClient';
import { Metadata } from 'next';
import { toPublicProduct, withPublicMediaUrl } from '@/lib/public-media';

// Forçage du rendu dynamique (cf. commentaire dans page.tsx) : les requêtes
// Supabase (listProducts, listActivePromotions) retournent 401 pendant le build
// si l'API n'est pas authentifiée. Le rendu à la demande évite ce piège.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Boutique — Purificateurs d\'eau et Filtres',
  description:
    'Découvrez notre catalogue de purificateurs d\'eau, osmoseurs inverses, filtres à eau et accessoires. Livraison et installation partout au Maroc.',
};

export default async function BoutiquePage() {
  // Chargement en parallèle : produits à vendre + promos actives uniquement.
  const [products, promotions] = await Promise.all([
    getCachedPublicProducts(),
    getCachedPublicPromotions(),
  ]);

  return (
    <BoutiqueClient
      initialProducts={products.map(toPublicProduct)}
      promotions={promotions.map(promotion =>
        withPublicMediaUrl('news', promotion)
      )}
    />
  );
}
