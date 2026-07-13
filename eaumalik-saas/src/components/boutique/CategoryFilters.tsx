'use client';

import type { ProductCategory } from '@/types';

const CATEGORIES: { key: 'all' | ProductCategory; label: string }[] = [
  { key: 'all',            label: 'Tous' },
  { key: 'purificateurs',  label: 'Systemes RO' },
  { key: 'industriel',     label: 'Industriel' },
  { key: 'consommables',   label: 'Filtres' },
];

interface Props {
  active: 'all' | ProductCategory;
  onChange: (key: 'all' | ProductCategory) => void;
  search: string;
  onSearch: (val: string) => void;
  resultCount?: number;
}

/**
 * Filtres pilule du nouveau design + recherche rapide.
 */
export default function CategoryFilters({ active, onChange, search, onSearch, resultCount }: Props) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-12 reveal revealed">
      <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            role="tab"
            aria-selected={active === c.key}
            className={`boutique-cat-btn px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-300 ${
              active === c.key
                ? 'active border-brand-600'
                : 'border-stone-200 bg-white text-stone-600 hover:border-brand-500'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {typeof resultCount === 'number' && (
          <span className="text-xs text-stone-400 font-medium hidden md:inline">
            {resultCount} produit{resultCount > 1 ? 's' : ''}
          </span>
        )}
        <div className="relative">
          <i
            className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={e => onSearch(e.target.value)}
            className="w-full md:w-[260px] pl-9 pr-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition text-stone-900 bg-white"
            placeholder="Rechercher un produit..."
            aria-label="Rechercher un produit"
          />
        </div>
      </div>
    </div>
  );
}