import 'server-only';

import { unstable_cache } from 'next/cache';
import { listActivePromotions, listProducts } from '@/data/repositories';

/**
 * Les pages publiques n'ont pas besoin de relire Supabase à chaque visite.
 * Le TTL court garde le catalogue frais tout en supprimant la latence réseau
 * de la grande majorité des requêtes. Les Server Actions continuent aussi à
 * appeler revalidatePath() après chaque modification.
 */
export const getCachedPublicProducts = unstable_cache(
  () => listProducts(),
  ['public-products-v1'],
  { revalidate: 60, tags: ['public-products'] },
);

export const getCachedPublicPromotions = unstable_cache(
  () => listActivePromotions(12),
  ['public-promotions-v1'],
  { revalidate: 60, tags: ['public-promotions'] },
);
