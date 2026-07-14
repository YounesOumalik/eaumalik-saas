import HeroSection from '@/components/landing/HeroSection';
import FiltrationSteps from '@/components/landing/FiltrationSteps';
import CatalogSection from '@/components/landing/CatalogSection';
import IndustrialSection from '@/components/landing/IndustrialSection';
import ContactSection from '@/components/landing/ContactSection';
import { listProducts } from '@/data/repositories';

// Page d'accueil — design "EauMalik — Catalogue Produits" (maquette adoptée le 2026-07-14) :
//   - HeroSection      : hero sombre + particules d'eau, CTA vers le catalogue
//   - FiltrationSteps  : processus de filtration en 5 étapes (animation au scroll)
//   - CatalogSection   : catalogue filtrable sur données réelles (listProducts)
//   - IndustrialSection : solutions professionnelles + modal de négociation
//   - ContactSection   : coordonnées + formulaire de contact (backend)
export default async function HomePage() {
  const products = await listProducts();
  const visible = products.filter((p) => !p.is_archived);
  return (
    <>
      <HeroSection />
      <FiltrationSteps />
      <CatalogSection products={visible} />
      <IndustrialSection />
      <ContactSection />
    </>
  );
}
