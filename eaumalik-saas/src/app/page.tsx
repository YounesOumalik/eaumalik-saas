import HeroSection from '@/components/landing/HeroSection';

// La page d'accueil fait des appels Supabase (listProducts, listActivePromotions)
// qui retournent 401 pendant le build si l'API n'est pas authentifiée. On force
// le rendu dynamique : la page est rendue à chaque requête, où les cookies et
// headers sont disponibles. Le cache HTTP (Cache-Control) reste géré en aval
// par Caddy/Nginx. ISR retiré car incompatible avec un build reproductible sans
// dépendance réseau stable côté build.
export const dynamic = 'force-dynamic';

import FiltrationSection from '@/components/landing/FiltrationSection';
import CatalogueFlipbookSection from '@/components/landing/CatalogueFlipbookSection';
import BoutiquePromotions from '@/components/boutique/BoutiquePromotions';
import ProductsPreview from '@/components/landing/ProductsPreview';
import IndustrialSection from '@/components/landing/IndustrialSection';
import ContactSection from '@/components/landing/ContactSection';
import { getCachedPublicProducts, getCachedPublicPromotions } from '@/data/publicCatalog';
import { toPublicProduct, withPublicMediaUrl } from '@/lib/public-media';

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
  //  - all : tous les produits actifs, dont on dérive les produits phares ;
  //  - promotions : carrousel public.
  // Une seule lecture catalogue suffit, au lieu de deux requêtes identiques.
  const [all, promotions] = await Promise.all([
    getCachedPublicProducts(),
    getCachedPublicPromotions(),
  ]);
  const featured = all.filter((product) => product.is_featured);
  const previewProducts = (featured.length > 0 ? featured : all.slice(0, 6))
    .slice(0, 6)
    .map(toPublicProduct);
  const publicPromotions = promotions.map((promotion) => withPublicMediaUrl('news', promotion));
  return (
    <>
      <HeroSection />
      <div className="landing-deferred">
        <FiltrationSection />
        <CatalogueFlipbookSection />
        <BoutiquePromotions promotions={publicPromotions} showNews={false} />
        <ProductsPreview products={previewProducts} />
        <IndustrialSection />
        <ContactSection />
      </div>
    </>
  );
}
