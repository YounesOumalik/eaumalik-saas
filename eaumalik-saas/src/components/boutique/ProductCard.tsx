'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { Product } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useCart } from '@/components/shared/CartProvider';
import { useToast } from '@/components/shared/ToastProvider';
import { useSupabaseAuth } from '@/components/shared/SupabaseAuthProvider';
import ProductDetailModal from './ProductDetailModal';

/**
 * Mapping des categories existantes vers les libelles visuels du nouveau design.
 */
const CATEGORY_META: Record<string, { label: string }> = {
  purificateurs: { label: 'Systeme RO' },
  industriel: { label: 'Industriel' },
  consommables: { label: 'Filtre' },
};

export default function ProductCard({ product }: { product: Product }) {
  const [openModal, setOpenModal] = useState(false);
  const { add } = useCart();
  const toast = useToast();
  const router = useRouter();
  const { session } = useSupabaseAuth();

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.stock === 0 || product.is_out_of_stock) return;
    // Politique produit : un compte client est obligatoire pour tout achat.
    if (!session) {
      toast('Veuillez vous connecter pour ajouter ce produit au panier.', 'info');
      router.push(`/login?callbackUrl=${encodeURIComponent('/boutique')}`);
      return;
    }
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
        className="group product-card-surface rounded-3xl overflow-hidden hover:shadow-xl hover:-translate-y-2 transition-all duration-500 cursor-pointer h-full flex flex-col"
      >
        <div className="relative h-56 flex items-center justify-center overflow-hidden surface-savor">
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
            <i className="fa-solid fa-droplet text-6xl" style={{ color: 'var(--primary-light)' }} aria-hidden="true" />
          )}

          {product.is_featured && (
            <div
              className="absolute top-4 left-4 px-3 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-wider"
              style={{ background: 'linear-gradient(135deg, var(--ocean-500), var(--ocean-700))' }}
            >
              Best-seller
            </div>
          )}
          {!product.is_featured && lowStock && (
            <div className="absolute top-4 left-4 px-3 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-wider"
                 style={{ background: 'var(--warning)' }}>
              Stock faible
            </div>
          )}
          {outOfStock && (
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-wider"
                 style={{ background: 'var(--text-muted)' }}>
              Rupture
            </div>
          )}
        </div>

        <div className="p-6 flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase pill-themed">
              {meta.label}
            </span>
          </div>
          <h3 className="font-serif text-xl font-semibold mb-2 text-heading line-clamp-2">
            {product.name}
          </h3>
          <p className="text-sm leading-relaxed mb-4 line-clamp-2 text-meta">
            {product.description ?? ''}
          </p>

          <div className="mt-auto flex items-center justify-between">
            <div>
              <span className="text-xs text-meta">A partir de</span>
              <span className="text-2xl font-bold ml-1" style={{ color: 'var(--primary)' }}>
                {outOfStock ? '-' : formatCurrency(product.price)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={outOfStock}
              aria-label={
                session
                  ? `Ajouter ${product.name} au panier`
                  : `Se connecter pour ajouter ${product.name} au panier`
              }
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--primary-glow)', color: 'var(--primary)' }}
              onMouseEnter={e => {
                if (!outOfStock) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, var(--ocean-500), var(--ocean-700))';
                  e.currentTarget.style.color = '#fff';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--primary-glow)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
            >
              <i
                className={session ? 'fa-solid fa-cart-plus text-lg' : 'fa-solid fa-user-plus text-lg'}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </article>

      {openModal && <ProductDetailModal product={product} onClose={() => setOpenModal(false)} />}
    </>
  );
}