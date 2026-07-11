'use client';

import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import type { Product } from '@/types';
import { useToast } from '@/components/shared/ToastProvider';

export default function StockTable({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const toast = useToast();

  const adjust = async (id: string, delta: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    const newStock = Math.max(0, product.stock + delta);
    setProducts(prev => prev.map(p => (p.id === id ? { ...p, stock: newStock } : p)));
    try {
      await fetch(`/api/products/${id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      });
      if (newStock < product.stock_alert_threshold) {
        toast(`Alerte : stock faible pour ${product.name} (${newStock})`, 'error');
      } else {
        toast(`Stock ${product.name} : ${newStock}`, 'info');
      }
    } catch {
      toast('Erreur reseau', 'error');
    }
  };

  return (
    <>
      <h2 className="font-display font-extrabold text-xl mb-6">Gestion des Stocks</h2>
      <div className="glass-card overflow-x-auto" style={{ transform: 'none' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Categorie</th>
              <th>Stock</th>
              <th>Seuil alerte</th>
              <th>Niveau</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => {
              const pct = Math.min(100, (p.stock / 50) * 100);
              const color = p.stock < 5 ? 'var(--danger)' : p.stock < 15 ? 'var(--warning)' : 'var(--success)';
              return (
                <tr key={p.id}>
                  <td className="text-sm font-medium">{p.name}</td>
                  <td className="text-sm capitalize">{p.category}</td>
                  <td className="font-semibold text-sm">{p.stock}</td>
                  <td className="text-sm" style={{ color: 'var(--text-muted)' }}>{p.stock_alert_threshold}</td>
                  <td style={{ minWidth: 120 }}>
                    <div className="h-1 rounded bg-[color:var(--border)] overflow-hidden">
                      <div className="h-full rounded transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-1.5">
                      <button onClick={() => adjust(p.id, 1)} className="btn-primary btn-sm" title="Ajouter 1"><Plus size={12} /></button>
                      <button onClick={() => adjust(p.id, -1)} className="btn-outline btn-sm" title="Retirer 1"><Minus size={12} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
