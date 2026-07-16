import HeroSection from '@/components/landing/HeroSection';

export const revalidate = 60;
import FiltrationSection from '@/components/landing/FiltrationSection';
import BoutiquePromotions from '@/components/boutique/BoutiquePromotions';
import ProductsPreview from '@/components/landing/ProductsPreview';
import IndustrialSection from '@/components/landing/IndustrialSection';
import ContactSection from '@/components/landing/ContactSection';
import { listProducts, listActivePromotions } from '@/data/repositories';

// Page d'accueil — design "EauMalik — Catalogue Produits" (maquette adoptée le 2026-07-14) :
//   - HeroSection        : hero sombre + particules d'eau, CTA vers /boutique
//   - FiltrationSection  : schéma RO animé + 5 étapes détaillées (déplacé depuis /boutique)
//   - BoutiquePromotions : bloc "Promotions" copié de la boutique (sans onglet Actualités,
//                          pour rester focalisé sur l'incitation à l'achat)
//   - ProductsPreview    : sélection de PRODUITS PHARES (is_featured=true) + CTA "Voir tout le catalogue"
//                          → la page d'accueil ne montre qu'un aperçu, le client doit aller sur
//                          /boutique pour voir l'intégralité du catalogue.
//   - IndustrialSection  : solutions professionnelles + modal de négociation
//   - ContactSection     : coordonnées + formulaire de contact (backend)
export default async function HomePage() {
  // Chargement en parallèle :
  //  - featured : seulement les produits phares (filtrés côté DB) ;
  //  - all : tous les actifs, utilisé en fallback si aucun produit n'est
  //    marqué is_featured, et pour le carrousel promotions.
  //    On évite ainsi une section vide côté landing.
  const [featured, all, promotions] = await Promise.all([
    listProducts({ featured: true }),
    listProducts(),
    listActivePromotions(12),
  ]);
  const previewProducts =
    (featured.length > 0 ? featured : all.filter((p) => !p.is_archived).slice(0, 6)).slice(0, 6);
  return (
    <>
      <HeroSection />
      <FiltrationSection />
      <BoutiquePromotions promotions={promotions} showNews={false} />
      <ProductsPreview products={previewProducts} />
      <IndustrialSection />
      <ContactSection />
    </>
  );
}
