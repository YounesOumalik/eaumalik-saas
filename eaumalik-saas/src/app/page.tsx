import HeroSection from '@/components/landing/HeroSection';
import FiltrationSection from '@/components/landing/FiltrationSection';
import BoutiquePromotions from '@/components/boutique/BoutiquePromotions';
import CatalogSection from '@/components/landing/CatalogSection';
import IndustrialSection from '@/components/landing/IndustrialSection';
import ContactSection from '@/components/landing/ContactSection';
import { listProducts, listActivePromotions } from '@/data/repositories';

// Page d'accueil — design "EauMalik — Catalogue Produits" (maquette adoptée le 2026-07-14) :
//   - HeroSection        : hero sombre + particules d'eau, CTA vers le catalogue
//   - FiltrationSection  : schéma RO animé + 5 étapes détaillées (déplacé depuis /boutique)
//   - BoutiquePromotions : bloc "Promotions" copié de la boutique (sans onglet Actualités,
//                          pour rester focalisé sur l'incitation à l'achat)
//   - CatalogSection     : catalogue filtrable sur données réelles (listProducts)
//   - IndustrialSection  : solutions professionnelles + modal de négociation
//   - ContactSection     : coordonnées + formulaire de contact (backend)
export default async function HomePage() {
  // Chargement en parallèle : produits du catalogue + promotions actives (carrousel boutique).
  const [products, promotions] = await Promise.all([
    listProducts(),
    listActivePromotions(12),
  ]);
  const visible = products.filter((p) => !p.is_archived);
  return (
    <>
      <HeroSection />
      <FiltrationSection />
      <BoutiquePromotions promotions={promotions} showNews={false} />
      <CatalogSection products={visible} />
      <IndustrialSection />
      <ContactSection />
    </>
  );
}
