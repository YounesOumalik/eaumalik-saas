'use client';

import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/components/shared/CartProvider';
import { useToast } from '@/components/shared/ToastProvider';
import type { Product } from '@/types';

interface Props {
  product: Product;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}

export default function AddToCartButton({ product, size = 'md', className = '', disabled }: Props) {
  const { add } = useCart();
  const toast = useToast();

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || product.stock === 0) return;
    add({
      product_id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      quantity: 1,
    });
    toast(`${product.name} ajoute au panier`, 'success');
  };

  const sizeClass = {
    sm: 'btn-sm text-xs px-3',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }[size];

  return (
    <button
      onClick={onClick}
      disabled={disabled || product.stock === 0}
      className={`btn-primary inline-flex items-center gap-2 ${sizeClass} ${className} disabled:opacity-50 disabled:cursor-not-allowed`}
      aria-label={`Ajouter ${product.name} au panier`}
    >
      <ShoppingCart size={size === 'sm' ? 12 : 14} aria-hidden="true" />
      <span>Ajouter</span>
    </button>
  );
}
