import { listProducts, listActivePromotions, listNews } from '@/data/repositories';
import BoutiqueClient from './boutique/BoutiqueClient';

// La page d'accueil affiche désormais la même version boutique que /boutique
// (source unique de vérité). L'ancienne version "landing" (HeroSection,
// FeaturesSection, ProductsPreview, TestimonialsSection, PromotionsCarousel)
// n'est plus importée par cette route — ses composants restent sur disque
// mais ne sont plus rendus publiquement (ils sont toujours disponibles si tu
// veux les réutiliser ailleurs).
//
// Avantage : une seule URL canonique du nouveau design, promos & actualités
// toujours visibles sur "/", aucun 307 inutile.
export default async function HomePage() {
  const [products, promotions, allNews] = await Promise.all([
    listProducts(),
    listActivePromotions(12),
    listNews(),
  ]);
  const newsOnly = (allNews || []).filter(n => !n.is_promotion);
  // La landing page ne montre que les produits phares (is_featured) + les promos.
  const featuredOnly = true;
  return (
    <BoutiqueClient
      initialProducts={products}
      promotions={promotions}
      news={newsOnly}
      featuredOnly={featuredOnly}
    />
  );
}
