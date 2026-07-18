import Image from 'next/image';
import Link from 'next/link';
import { CATEGORY_LABELS } from '@/types';
import type { Product } from '@/types';
import AddToCartButton from '@/components/boutique/AddToCartButton';
import { formatCurrency, shouldSkipImageOptimization } from '@/lib/utils';

export default function ProductsPreview({ products }: { products: Product[] }) {
  return (
    <section className="py-24 px-4" style={{ background: 'var(--bg-surface)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 reveal">
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold mb-4">
            Nos produits <span className="gradient-text">phares</span>
          </h2>
          <p className="max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Des purificateurs haute performance pour une eau pure et saine, chaque jour.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(p => (
            <div key={p.id} className="glass-card overflow-hidden reveal">
              <div className="aspect-square overflow-hidden relative" style={{ background: 'var(--bg-surface)' }}>
                {p.image_url && (
                  <Image
                    src={p.image_url}
                    alt={p.name}
                    width={400}
                    height={400}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                    unoptimized={shouldSkipImageOptimization(p.image_url)}
                  />
                )}
              </div>
              <div className="p-5">
                <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--primary-light)' }}>
                  {CATEGORY_LABELS[p.category] ?? p.category}
                </div>
                <h3 className="font-display font-bold text-base mb-1">{p.name}</h3>
                <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{p.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-display font-extrabold gradient-text">{formatCurrency(p.price)}</span>
                  <AddToCartButton product={p} size="sm" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-12 reveal">
          <Link href="/boutique" className="btn-outline">
            Voir tout le catalogue <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
