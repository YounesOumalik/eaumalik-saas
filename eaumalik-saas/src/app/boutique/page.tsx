import { listProducts, listActivePromotions, listNews } from '@/data/repositories';
import BoutiqueClient from './BoutiqueClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Boutique — Purificateurs d\'eau et Filtres',
  description:
    'Découvrez notre catalogue de purificateurs d\'eau, osmoseurs inverses, filtres à eau et accessoires. Livraison et installation partout au Maroc.',
};

export default async function BoutiquePage() {
  // Chargement en parallèle : produits + promos visibles + actualités.
  // On récupère TOUTES les news (promos incluses) puis `listActivePromotions`
  // re-filtre `promotionOnly=true`. Pour éviter un doublon côté UI, le composant
  // BoutiquePromotions filtre lui-même les promos hors onglet "news".
  const [products, promotions, allNews] = await Promise.all([
    listProducts(),
    listActivePromotions(12),
    listNews(),
  ]);

  const newsOnly = (allNews || []).filter(n => !n.is_promotion);

  return (
    <BoutiqueClient
      initialProducts={products}
      promotions={promotions}
      news={newsOnly}
    />
  );
}
