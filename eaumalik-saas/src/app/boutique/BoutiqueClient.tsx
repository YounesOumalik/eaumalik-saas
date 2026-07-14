'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Product, ProductCategory, News } from '@/types';
import ProductCard from '@/components/boutique/ProductCard';
import CategoryFilters from '@/components/boutique/CategoryFilters';
import BoutiqueHero from '@/components/boutique/BoutiqueHero';
import BoutiqueFiltration from '@/components/boutique/BoutiqueFiltration';
import BoutiquePromotions from '@/components/boutique/BoutiquePromotions';
import { useToast } from '@/components/shared/ToastProvider';

/**
 * Page boutique :
 *  - Hero + Promotions (offres uniquement)
 *  - Catalogue filtres + recherche + grille de cartes (articles a vendre)
 * Toutes les fonctions existantes (panier, toast, modal) sont preservees.
 */
export default function BoutiqueClient({
  initialProducts,
  promotions = [],
  featuredOnly = false,
}: {
  initialProducts: Product[];
  promotions?: News[];
  /** Landing page : n'affiche que les produits phares (is_featured). */
  featuredOnly?: boolean;
}) {
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
      const featuredOk = !featuredOnly || p.is_featured;
      return catOk && searchOk && notArchived && featuredOk;
    });
  }, [initialProducts, category, search, featuredOnly]);

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
    <div className="surface-page">
      <BoutiqueHero />

      <BoutiqueFiltration />

      <BoutiquePromotions promotions={promotions} showNews={false} />

      {/* CATALOGUE */}
      <section id="catalogue" className="py-16 md:py-20 px-6 surface-page">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 reveal revealed">
            <span className="text-xs font-bold uppercase tracking-[0.3em] mb-4 block"
                  style={{ color: 'var(--primary)' }}>
              {featuredOnly ? 'Nos coups de cœur' : 'Notre catalogue'}
            </span>
            <h2 className="font-serif text-4xl md:text-6xl font-normal leading-[0.9] tracking-tighter mb-4 text-heading">
              {featuredOnly ? (
                <>Nos produits<br /><em style={{ color: 'var(--primary)' }}>phares</em></>
              ) : (
                <>Explorez nos<br /><em style={{ color: 'var(--primary)' }}>produits</em></>
              )}
            </h2>
            <p className="text-lg font-light max-w-xl mx-auto text-meta">
              {featuredOnly
                ? 'Une selection de nos meilleures solutions de purification d\'eau. Decouvrez tout le catalogue dans la boutique.'
                : 'Des solutions completes pour chaque besoin de purification d\'eau.'}
            </p>
          </div>

          {!featuredOnly && (
            <CategoryFilters
              active={category}
              onChange={setCategory}
              search={search}
              onSearch={setSearch}
              resultCount={filtered.length}
            />
          )}

          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <i
                className="fa-solid fa-box-open text-5xl mb-4 text-meta"
                aria-hidden="true"
              />
              <p className="text-meta">Aucun produit ne correspond a votre recherche.</p>
              <button
                type="button"
                onClick={() => {
                  setCategory('all');
                  setSearch('');
                  toast('Filtres reinitialises', 'info');
                }}
                className="mt-4 px-5 py-2 rounded-xl pill-themed text-sm font-semibold transition"
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

          {featuredOnly && (
            <div className="text-center mt-14">
              <Link
                href="/boutique"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full btn-primary text-sm font-semibold transition"
              >
                Voir toute la boutique
                <i className="fa-solid fa-arrow-right" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}