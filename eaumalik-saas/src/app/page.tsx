import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import ProductsPreview from '@/components/landing/ProductsPreview';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import { listProducts, getCompanyProfile } from '@/data/repositories';

export default async function HomePage() {
  const [featured, company] = await Promise.all([
    listProducts({ featured: true }),
    getCompanyProfile(),
  ]);

  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <ProductsPreview products={featured} />
      <TestimonialsSection />

      <section className="py-24 px-4 reveal" style={{ background: 'var(--bg-surface)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold mb-4">
            Besoin d&apos;une solution <span className="gradient-text">sur mesure</span> ?
          </h2>
          <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>
            Nos experts analysent votre besoin et vous proposent la solution optimale pour votre eau.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href={`tel:${company.phone.replace(/\s/g, '')}`} className="btn-primary text-base px-8 py-3.5">
              <i className="fa-solid fa-phone" aria-hidden="true" /> {company.phone}
            </a>
            <a href={`mailto:${company.email}`} className="btn-outline text-base px-8 py-3.5">
              <i className="fa-solid fa-envelope" aria-hidden="true" /> Nous contacter
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
