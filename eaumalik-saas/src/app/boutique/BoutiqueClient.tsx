'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Product, ProductCategory } from '@/types';
import ProductCard from '@/components/boutique/ProductCard';
import CategoryFilters from '@/components/boutique/CategoryFilters';
import BoutiqueHero from '@/components/boutique/BoutiqueHero';
import BoutiqueFiltration from '@/components/boutique/BoutiqueFiltration';
import BoutiqueIndustrial from '@/components/boutique/BoutiqueIndustrial';
import BoutiqueContact from '@/components/boutique/BoutiqueContact';
import { useToast } from '@/components/shared/ToastProvider';

/**
 * Page boutique du nouveau design :
 *  - Hero (Catalog Produits + navbar local)
 *  - 5 etapes de filtration
 *  - Catalogue filtres + recherche + grille de cartes
 *  - Section industrielle (6 secteurs)
 *  - Contact / devis
 * Toutes les fonctions existantes (panier, toast, modal) sont preservees.
 */
export default function BoutiqueClient({ initialProducts }: { initialProducts: Product[] }) {
  const [category, setCategory] = useState<'all' | ProductCategory>('all');
  const [search, setSearch] = useState('');
  const toast = useToast();

  const filtered = useMemo(() => {
    return initialProducts.filter(p => {
      const catOk = category === 'all' || p.category === category;
      const q = search.trim().toLowerCase();
      const searchOk =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q);
      const notArchived = !p.is_archived;
      return catOk && searchOk && notArchived;
    });
  }, [initialProducts, category, search]);

  // Smooth-scroll vers la grille de catalogue depuis le hero / navbar local.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const link = target?.closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute('href') || '';
      if (!href || href === '#') return;
      const id = href.slice(1);
      const el = document.getElementById(id);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  return (
    <div className="bg-white">
      <BoutiqueHero />

      <BoutiqueFiltration />

      {/* CATALOGUE */}
      <section id="catalogue" className="py-32 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 reveal revealed">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand-600 mb-4 block">
              Notre catalogue
            </span>
            <h2 className="font-serif text-4xl md:text-6xl font-normal leading-[0.85] tracking-tighter mb-6 text-stone-900">
              Explorez nos<br />
              <em className="text-brand-700">produits</em>
            </h2>
            <p className="text-lg text-stone-500 font-light max-w-xl mx-auto">
              Des solutions completes pour chaque besoin de purification d&apos;eau.
            </p>
          </div>

          <CategoryFilters
            active={category}
            onChange={setCategory}
            search={search}
            onSearch={setSearch}
            resultCount={filtered.length}
          />

          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <i
                className="fa-solid fa-box-open text-5xl mb-4 text-stone-300"
                aria-hidden="true"
              />
              <p className="text-stone-500">Aucun produit ne correspond a votre recherche.</p>
              <button
                type="button"
                onClick={() => {
                  setCategory('all');
                  setSearch('');
                  toast('Filtres reinitialises', 'info');
                }}
                className="mt-4 px-5 py-2 rounded-xl bg-brand-50 text-brand-700 text-sm font-semibold hover:bg-brand-100 transition"
              >
                Reinitialiser les filtres
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      <BoutiqueIndustrial />

      <BoutiqueContact />
    </div>
  );
}