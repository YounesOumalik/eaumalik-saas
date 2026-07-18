'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CATEGORY_LABELS } from '@/types';
import type { Product } from '@/types';
import { formatCurrency, shouldSkipImageOptimization } from '@/lib/utils';
import { useCart } from '@/components/shared/CartProvider';
import { useToast } from '@/components/shared/ToastProvider';
import { useSupabaseAuth } from '@/components/shared/SupabaseAuthProvider';
import ProductDetailModal from './ProductDetailModal';
import AddToCartButton from './AddToCartButton';

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
    if (product.price_on_request) return;
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
        className="group glass-card overflow-hidden hover:shadow-xl hover:-translate-y-2 transition-all duration-500 cursor-pointer h-full flex flex-col"
      >
        <div className="aspect-square overflow-hidden relative" style={{ background: 'var(--bg-surface)' }}>
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              width={600}
              height={600}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
              unoptimized={shouldSkipImageOptimization(product.image_url)}
            />
          ) : (
            <i className="fa-solid fa-droplet text-6xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ color: 'var(--primary-light)' }} aria-hidden="true" />
          )}

          {product.is_featured && (
            <div
              className="absolute top-4 left-4 px-3 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-wider z-10"
              style={{ background: 'linear-gradient(135deg, var(--ocean-500), var(--ocean-700))' }}
            >
              Best-seller
            </div>
          )}
          {!product.is_featured && lowStock && (
            <div className="absolute top-4 left-4 px-3 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-wider z-10"
                 style={{ background: 'var(--warning)' }}>
              Stock faible
            </div>
          )}
          {outOfStock && (
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-wider z-10"
                 style={{ background: 'var(--text-muted)' }}>
              Rupture
            </div>
          )}
        </div>

        <div className="p-5 flex flex-col flex-1">
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--primary-light)' }}>
            {CATEGORY_LABELS[product.category] ?? product.category}
          </div>
          <h3 className="font-display font-bold text-base mb-1 text-heading line-clamp-2">
            {product.name}
          </h3>
          <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
            {product.description ?? ''}
          </p>

          <div className="mt-auto flex items-center justify-between">
            <span className="text-xl font-display font-extrabold gradient-text">
              {product.price_on_request ? 'Sur devis' : outOfStock ? '-' : formatCurrency(product.price)}
            </span>
            <AddToCartButton product={product} size="sm" requireAuth={true} />
          </div>
        </div>
      </article>

      {openModal && <ProductDetailModal product={product} onClose={() => setOpenModal(false)} />}
    </>
  );
}
