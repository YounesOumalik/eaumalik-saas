'use client';

import type { ProductCategory } from '@/types';

const CATEGORIES: { key: 'all' | ProductCategory; label: string }[] = [
  { key: 'all',            label: 'Tous' },
  { key: 'purificateurs',  label: 'Purificateurs' },
  { key: 'industriel',     label: 'Industriel' },
  { key: 'consommables',   label: 'Consommables' },
];

interface Props {
  active: 'all' | ProductCategory;
  onChange: (key: 'all' | ProductCategory) => void;
  search: string;
  onSearch: (val: string) => void;
}

export default function CategoryFilters({ active, onChange, search, onSearch }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-8">
      <div className="flex flex-wrap gap-2" role="tablist">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            role="tab"
            aria-selected={active === c.key}
            className={active === c.key ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="ml-auto">
        <div className="relative">
          <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={e => onSearch(e.target.value)}
            className="form-input pl-9"
            style={{ width: 220 }}
            placeholder="Rechercher un produit..."
            aria-label="Rechercher un produit"
          />
        </div>
      </div>
    </div>
  );
}
