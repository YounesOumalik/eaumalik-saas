'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { CartItem } from '@/types';
import { useSupabaseAuth } from './SupabaseAuthProvider';
import { saveUserCartAction, getUserCartAction } from '@/app/actions/clientActions';

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: CartItem) => void;
  remove: (productId: string) => void;
  updateQty: (productId: string, delta: number) => void;
  clear: () => void;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'eaumalik_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [serverCartLoaded, setServerCartLoaded] = useState(false);
  const { session, user } = useSupabaseAuth();

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);

  // Fetch cart from server on login (côté Supabase à activer en phase 2 d'auth).
  useEffect(() => {
    if (!user) {
      setServerCartLoaded(true);
      return;
    }
    setServerCartLoaded(false);
    const fetchServerCart = async () => {
      try {
        const res = await getUserCartAction();
        if (res.success && Array.isArray(res.items)) {
          setItems(res.items as CartItem[]);
        }
      } finally {
        setServerCartLoaded(true);
      }
    };
    void fetchServerCart();
  }, [user]);

  // Persist local and server-side
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    if (user && serverCartLoaded) {
      void saveUserCartAction(items);
    }
  }, [items, hydrated, serverCartLoaded, user]);

  const add = useCallback((item: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.product_id === item.product_id);
      if (existing) {
        return prev.map(i => i.product_id === item.product_id ? { ...i, quantity: i.quantity + item.quantity } : i);
      }
      return [...prev, item];
    });
    setIsOpen(true);
  }, []);

  const remove = useCallback((productId: string) => {
    setItems(prev => prev.filter(i => i.product_id !== productId));
  }, []);

  const updateQty = useCallback((productId: string, delta: number) => {
    setItems(prev => prev.map(i =>
      i.product_id === productId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i
    ));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, count, subtotal, add, remove, updateQty, clear, isOpen, setOpen: setIsOpen }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
