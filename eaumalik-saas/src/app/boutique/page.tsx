import { listProducts, listActivePromotions } from '@/data/repositories';
import BoutiqueClient from './BoutiqueClient';
import { Metadata } from 'next';
import { withPublicMediaUrl } from '@/lib/public-media';

export const metadata: Metadata = {
  title: 'Boutique — Purificateurs d\'eau et Filtres',
  description:
    'Découvrez notre catalogue de purificateurs d\'eau, osmoseurs inverses, filtres à eau et accessoires. Livraison et installation partout au Maroc.',
};

export default async function BoutiquePage() {
  // Chargement en parallèle : produits à vendre + promos actives uniquement.
  const [products, promotions] = await Promise.all([
    listProducts(),
    listActivePromotions(12),
  ]);

  return (
    <BoutiqueClient
      initialProducts={products.map(product =>
        withPublicMediaUrl('product', product)
      )}
      promotions={promotions.map(promotion =>
        withPublicMediaUrl('news', promotion)
      )}
    />
  );
}
