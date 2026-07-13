'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Product } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useCart } from '@/components/shared/CartProvider';
import { useToast } from '@/components/shared/ToastProvider';
import ProductDetailModal from './ProductDetailModal';

/**
 * Mapping des categories existantes vers les libelles visuels du nouveau design.
 */
const CATEGORY_META: Record<string, { label: string; color: string }> = {
  purificateurs: { label: 'Systeme RO', color: 'bg-brand-50 text-brand-700' },
  industriel: { label: 'Industriel', color: 'bg-stone-100 text-stone-700' },
  consommables: { label: 'Filtre', color: 'bg-blue-50 text-blue-700' },
};

export default function ProductCard({ product }: { product: Product }) {
  const [openModal, setOpenModal] = useState(false);
  const { add } = useCart();
  const toast = useToast();

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.stock === 0 || product.is_out_of_stock) return;
    add({
      product_id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      quantity: 1,
    });
    toast(`${product.name} ajoute au panier`, 'success');
  };

  const outOfStock = product.stock === 0 || !!product.is_out_of_stock;
  const lowStock =
    product.stock > 0 && product.stock < product.stock_alert_threshold && !product.is_out_of_stock;

  const meta = CATEGORY_META[product.category] ?? {
    label: product.category,
    color: 'bg-stone-100 text-stone-700',
  };

  return (
    <>
      <article
        onClick={() => setOpenModal(true)}
        onKeyDown={e => {
          if (e.key === 'Enter') setOpenModal(true);
        }}
        role="button"
        tabIndex={0}
        aria-label={`Voir ${product.name}`}
        className="group bg-white rounded-3xl border border-stone-100 overflow-hidden hover:shadow-xl hover:-translate-y-2 transition-all duration-500 cursor-pointer h-full flex flex-col"
      >
        <div className="relative h-56 bg-gradient-to-br from-brand-50 to-cyan-50 flex items-center justify-center overflow-hidden">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              width={600}
              height={400}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              unoptimized
            />
          ) : (
            <i className="fa-solid fa-droplet text-6xl text-brand-300" aria-hidden="true" />
          )}

          {product.is_featured && (
            <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-brand-600 text-white text-[10px] font-bold uppercase tracking-wider">
              Best-seller
            </div>
          )}
          {!product.is_featured && lowStock && (
            <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider">
              Stock faible
            </div>
          )}
          {outOfStock && (
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-stone-700 text-white text-[10px] font-bold uppercase tracking-wider">
              Rupture
            </div>
          )}
        </div>

        <div className="p-6 flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${meta.color}`}>
              {meta.label}
            </span>
          </div>
          <h3 className="font-serif text-xl font-semibold mb-2 text-stone-900 line-clamp-2">
            {product.name}
          </h3>
          <p className="text-sm text-stone-500 leading-relaxed mb-4 line-clamp-2">
            {product.description ?? ''}
          </p>

          <div className="mt-auto flex items-center justify-between">
            <div>
              <span className="text-xs text-stone-400">A partir de</span>
              <span className="text-2xl font-bold text-brand-700 ml-1">
                {outOfStock ? '-' : formatCurrency(product.price)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={outOfStock}
              aria-label={`Ajouter ${product.name} au panier`}
              className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-brand-600"
            >
              <i className="fa-solid fa-cart-plus text-lg" aria-hidden="true" />
            </button>
          </div>
        </div>
      </article>

      {openModal && <ProductDetailModal product={product} onClose={() => setOpenModal(false)} />}
    </>
  );
}