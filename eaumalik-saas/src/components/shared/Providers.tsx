'use client';

import { ReactNode } from 'react';
import { CartProvider } from './CartProvider';
import { ThemeProvider } from './ThemeProvider';
import { ToastProvider } from './ToastProvider';
import { SupabaseAuthProvider } from './SupabaseAuthProvider';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SupabaseAuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </ToastProvider>
      </ThemeProvider>
    </SupabaseAuthProvider>
  );
}
