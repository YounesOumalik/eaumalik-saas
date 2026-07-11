'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Product } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useCart } from '@/components/shared/CartProvider';
import { useToast } from '@/components/shared/ToastProvider';
import ProductDetailModal from './ProductDetailModal';

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

  const lowStock = product.stock > 0 && product.stock < product.stock_alert_threshold && !product.is_out_of_stock;
  const outOfStock = product.stock === 0 || !!product.is_out_of_stock;

  return (
    <>
      <article
        className="glass-card overflow-hidden cursor-pointer group"
        onClick={() => setOpenModal(true)}
        onKeyDown={e => { if (e.key === 'Enter') setOpenModal(true); }}
        role="button"
        tabIndex={0}
        aria-label={`Voir ${product.name}`}
      >
        <div className="aspect-square overflow-hidden relative" style={{ background: 'var(--bg-surface)' }}>
          {product.image_url && (
            <Image
              src={product.image_url}
              alt={product.name}
              width={400}
              height={400}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              unoptimized
            />
          )}
          <div className="absolute top-3 left-3">
            <span
              className="text-[0.65rem] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-white"
              style={{ background: 'var(--primary)' }}
            >
              {product.category}
            </span>
          </div>
          {lowStock && (
            <div className="absolute top-3 right-3">
              <span className="text-[0.65rem] font-bold px-2.5 py-1 rounded-full text-white" style={{ background: 'var(--danger)' }}>
                Stock faible
              </span>
            </div>
          )}
          {outOfStock && (
            <div className="absolute top-3 right-3">
              <span className="text-[0.65rem] font-bold px-2.5 py-1 rounded-full text-white" style={{ background: 'var(--text-muted)' }}>
                Rupture
              </span>
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-display font-bold text-sm mb-1 line-clamp-2">{product.name}</h3>
          <p className="text-xs mb-3 line-clamp-1" style={{ color: 'var(--text-muted)' }}>{product.description}</p>
          <div className="flex items-center justify-between">
            <span className="text-lg font-display font-extrabold gradient-text">{formatCurrency(product.price)}</span>
            <button
              onClick={handleAdd}
              disabled={outOfStock}
              className="btn-primary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`Ajouter ${product.name} au panier`}
            >
              <i className="fa-solid fa-cart-plus text-xs" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            {outOfStock ? 'Rupture' : `${product.stock} en stock`}
          </div>
        </div>
      </article>

      {openModal && (
        <ProductDetailModal product={product} onClose={() => setOpenModal(false)} />
      )}
    </>
  );
}
