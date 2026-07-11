import { listProducts } from '@/data/repositories';
import BoutiqueClient from './BoutiqueClient';

export default async function BoutiquePage() {
  const products = await listProducts();
  return <BoutiqueClient initialProducts={products} />;
}
