'use client';

import { useMemo, useState } from 'react';
import type { Product, ProductCategory } from '@/types';
import ProductCard from '@/components/boutique/ProductCard';
import CategoryFilters from '@/components/boutique/CategoryFilters';

export default function BoutiqueClient({ initialProducts }: { initialProducts: Product[] }) {
  const [category, setCategory] = useState<'all' | ProductCategory>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return initialProducts.filter(p => {
      const catOk = category === 'all' || p.category === category;
      const q = search.trim().toLowerCase();
      const searchOk = !q
        || p.name.toLowerCase().includes(q)
        || (p.description ?? '').toLowerCase().includes(q);
      const notArchived = !p.is_archived;
      return catOk && searchOk && notArchived;
    });
  }, [initialProducts, category, search]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-display font-extrabold mb-2">
          Notre <span className="gradient-text">Catalogue</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Purificateurs, stations industrielles et consommables pour le traitement de votre eau.
        </p>
      </header>

      <CategoryFilters
        active={category}
        onChange={setCategory}
        search={search}
        onSearch={setSearch}
      />

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <i className="fa-solid fa-box-open text-4xl mb-4" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          <p style={{ color: 'var(--text-muted)' }}>Aucun produit ne correspond à votre recherche.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(p => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
