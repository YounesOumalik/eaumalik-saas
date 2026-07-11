import { listProducts } from '@/data/repositories';
import BoutiqueClient from './BoutiqueClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Boutique — Purificateurs d\'eau et Filtres',
  description:
    'Découvrez notre catalogue de purificateurs d\'eau, osmoseurs inverses, filtres à eau et accessoires. Livraison et installation partout au Maroc.',
};

export default async function BoutiquePage() {
  const products = await listProducts();
  return <BoutiqueClient initialProducts={products} />;
}
