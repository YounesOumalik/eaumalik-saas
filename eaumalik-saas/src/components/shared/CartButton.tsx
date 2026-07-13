'use client';

import Link from 'next/link';
import { useCart } from './CartProvider';

export default function CartButton() {
  const { count } = useCart();
  return (
    <Link
      href="/panier"
      className="relative min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg flex items-center justify-center transition-colors hover:scale-105"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
      aria-label={`Panier (${count} article${count > 1 ? 's' : ''})`}
    >
      <i className="fa-solid fa-cart-shopping text-sm" aria-hidden="true" />
      {count > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[0.65rem] font-bold flex items-center justify-center text-white"
          style={{ background: 'var(--primary)' }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
