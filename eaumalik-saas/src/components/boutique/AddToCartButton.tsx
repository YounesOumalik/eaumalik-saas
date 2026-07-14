'use client';

import { ShoppingCart, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/components/shared/CartProvider';
import { useToast } from '@/components/shared/ToastProvider';
import { useSupabaseAuth } from '@/components/shared/SupabaseAuthProvider';
import type { Product } from '@/types';

interface Props {
  product: Product;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  /** Si vrai, exige que l'utilisateur soit authentifié avant d'ajouter au panier. */
  requireAuth?: boolean;
}

export default function AddToCartButton({
  product,
  size = 'md',
  className = '',
  disabled,
  requireAuth = false,
}: Props) {
  const { add } = useCart();
  const toast = useToast();
  const router = useRouter();
  const { session } = useSupabaseAuth();

  const isOutOfStock = product.stock === 0 || product.is_out_of_stock;

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isOutOfStock) return;

    // Politique produit : un compte client est OBLIGATOIRE pour tout achat.
    if (requireAuth && !session) {
      toast('Veuillez vous connecter pour ajouter un produit au panier.', 'info');
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
    toast(`${product.name} ajouté au panier`, 'success');
  };

  const sizeClass = {
    sm: 'btn-sm text-xs px-3',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }[size];

  const showLoginLabel = requireAuth && !session;

  return (
    <button
      onClick={onClick}
      disabled={disabled || isOutOfStock}
      className={`btn-primary inline-flex items-center gap-2 ${sizeClass} ${className} disabled:opacity-50 disabled:cursor-not-allowed`}
      aria-label={
        isOutOfStock
          ? 'Produit en rupture'
          : showLoginLabel
            ? `Se connecter pour ajouter ${product.name} au panier`
            : `Ajouter ${product.name} au panier`
      }
    >
      {showLoginLabel ? (
        <UserPlus size={size === 'sm' ? 12 : 14} aria-hidden="true" />
      ) : (
        <ShoppingCart size={size === 'sm' ? 12 : 14} aria-hidden="true" />
      )}
      <span>
        {isOutOfStock ? 'Rupture' : showLoginLabel ? 'Se connecter' : 'Ajouter'}
      </span>
    </button>
  );
}