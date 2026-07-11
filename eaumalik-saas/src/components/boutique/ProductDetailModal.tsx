'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import type { Product } from '@/types';
import { formatCurrency } from '@/lib/utils';
import AddToCartButton from './AddToCartButton';

interface Props {
  product: Product;
  onClose: () => void;
}

export default function ProductDetailModal({ product, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-modal-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`product-${product.id}-title`}
    >
      <div className="glass-card max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center z-10 hover:bg-black/30 transition-colors"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          aria-label="Fermer"
        >
          <X size={14} aria-hidden="true" />
        </button>
        <div className="md:flex">
          <div className="md:w-1/2">
            {product.image_url && (
              <Image
                src={product.image_url}
                alt={product.name}
                width={500}
                height={500}
                className="w-full aspect-square object-cover"
                style={{ borderRadius: '1rem 0 0 1rem' }}
                unoptimized
              />
            )}
          </div>
          <div className="md:w-1/2 p-6">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--primary-light)' }}>
              {product.category}
            </span>
            <h2 id={`product-${product.id}-title`} className="font-display font-extrabold text-xl mt-2 mb-3">
              {product.name}
            </h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {product.description}
            </p>
            {product.specs && product.specs.length > 0 && (
              <div className="space-y-2 mb-5">
                {product.specs.map(s => (
                  <div key={s} className="flex items-center gap-2 text-sm">
                    <i className="fa-solid fa-check text-xs" style={{ color: 'var(--success)' }} aria-hidden="true" /> {s}
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-display font-extrabold gradient-text">{formatCurrency(product.price)}</span>
              <span
                className="text-sm"
                style={{
                  color: product.stock > 5 ? 'var(--success)'
                       : product.stock > 0 ? 'var(--warning)'
                       : 'var(--danger)',
                }}
              >
                {product.stock > 0 ? `${product.stock} en stock` : 'Rupture'}
              </span>
            </div>
            <AddToCartButton product={product} size="lg" className="w-full justify-center" />
          </div>
        </div>
      </div>
    </div>
  );
}
