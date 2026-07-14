import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import ProductsPreview from '@/components/landing/ProductsPreview';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import PromotionsCarousel from '@/components/landing/PromotionsCarousel';
import { listProducts, listActivePromotions } from '@/data/repositories';

// Modèle de page d'accueil "landing" (utilisé avant le refactor du 2026-07-14) :
//   - HeroSection         : message d'accueil (logo animé, titre, CTAs)
//   - FeaturesSection     : "Pourquoi choisir EAUMALIK ?" (6 cartes)
//   - ProductsPreview     : "Nos produits phares" (produits is_featured)
//   - TestimonialsSection : "Ce que disent nos clients" (3 avis)
//   - PromotionsCarousel  : carrousel des promotions actives
export default async function HomePage() {
  const [products, promotions] = await Promise.all([
    listProducts(),
    listActivePromotions(12),
  ]);
  const featured = products.filter(p => p.is_featured && !p.is_archived);
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <ProductsPreview products={featured} />
      <TestimonialsSection />
      <PromotionsCarousel promotions={promotions} />
    </>
  );
}
