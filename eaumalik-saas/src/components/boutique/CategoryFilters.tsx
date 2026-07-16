'use client';

import { CATEGORY_LABELS } from '@/types';
import type { ProductCategory } from '@/types';

const CATEGORIES: { key: 'all' | ProductCategory; label: string }[] = [
  { key: 'all',            label: 'Tous' },
  { key: 'purificateurs',  label: CATEGORY_LABELS.purificateurs },
  { key: 'industriel',     label: CATEGORY_LABELS.industriel },
  { key: 'consommables',   label: CATEGORY_LABELS.consommables },
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
      <div className="flex flex-wrap gap-2 justify-center lg:justify-start" role="tablist">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            role="tab"
            aria-selected={active === c.key}
            className={`btn-chip ${active === c.key ? 'active btn-chip-fill' : ''}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {typeof resultCount === 'number' && (
          <span className="text-xs font-medium hidden md:inline text-meta">
            {resultCount} produit{resultCount > 1 ? 's' : ''}
          </span>
        )}
        <div className="relative">
          <i
            className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-meta"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={e => onSearch(e.target.value)}
            className="input-themed w-full md:w-[260px] pl-9"
            placeholder="Rechercher un produit..."
            aria-label="Rechercher un produit"
          />
        </div>
      </div>
    </div>
  );
}