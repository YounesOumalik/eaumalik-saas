'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Star, X, Save } from 'lucide-react';
import Image from 'next/image';
import type { Product, ProductCategory } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/shared/ToastProvider';

const CATEGORIES: ProductCategory[] = ['purificateurs', 'industriel', 'consommables'];

const FormSchema = z.object({
  name: z.string().min(2),
  price: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0),
  category: z.enum(['purificateurs', 'industriel', 'consommables']),
  description: z.string().max(500).optional(),
  is_featured: z.boolean().optional(),
});
type FormData = z.infer<typeof FormSchema>;

export default function CatalogueManager({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [editing, setEditing] = useState<Product | null>(null);
  const toast = useToast();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
  });

  const onSubmit = (data: FormData) => {
    if (editing) {
      setProducts(prev =>
        prev.map(p => p.id === editing.id ? { ...p, ...data } : p)
      );
      toast('Produit mis a jour', 'success');
    } else {
      const newProduct: Product = {
        id: `p-${Date.now()}`,
        slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        image_url: 'https://picsum.photos/seed/' + Math.random().toString(36).slice(2, 8) + '/400/400',
        specs: [],
        stock_alert_threshold: 5,
        filter_lifespan_months: data.category === 'consommables' ? 12 : null,
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setProducts(prev => [newProduct, ...prev]);
      toast('Produit ajoute', 'success');
    }
    setEditing(null);
    reset();
  };

  const startEdit = (p: Product) => {
    setEditing(p);
    reset({
      name: p.name,
      price: p.price,
      stock: p.stock,
      category: p.category,
      description: p.description ?? '',
      is_featured: p.is_featured,
    });
  };

  const remove = (id: string) => {
    if (!confirm('Supprimer ce produit ?')) return;
    setProducts(prev => prev.filter(p => p.id !== id));
    toast('Suppression simulee (demo)', 'info');
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-extrabold text-xl">Gestion du Catalogue</h2>
        <button onClick={() => { setEditing(null); reset(); }} className="btn-primary btn-sm">
          <Plus size={14} /> Nouveau produit
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6 mb-6 space-y-4" style={{ transform: 'none' }}>
        <h3 className="font-display font-bold text-lg">
          {editing ? 'Modifier le produit' : 'Ajouter un produit'}
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Nom *</label>
            <input className="form-input" {...register('name')} />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="form-label">Categorie *</label>
            <select className="form-input" {...register('category')}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Prix (DH) *</label>
            <input type="number" step="0.01" className="form-input" {...register('price')} />
          </div>
          <div>
            <label className="form-label">Stock *</label>
            <input type="number" className="form-input" {...register('stock')} />
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={3} {...register('description')} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register('is_featured')} />
            <span className="text-sm flex items-center gap-1"><Star size={12} className="text-amber-400" /> Produit phare</span>
          </label>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn-primary">
            <Save size={14} /> {editing ? 'Enregistrer' : 'Ajouter'}
          </button>
          {editing && (
            <button type="button" onClick={() => { setEditing(null); reset(); }} className="btn-outline">
              <X size={14} /> Annuler
            </button>
          )}
        </div>
      </form>

      <div className="glass-card overflow-x-auto" style={{ transform: 'none' }}>
        <table className="data-table">
          <thead>
            <tr><th>Produit</th><th>Categorie</th><th>Prix</th><th>Stock</th><th>Phare</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td>
                  <div className="flex items-center gap-3">
                    {p.image_url && (
                      <Image src={p.image_url} alt={p.name} width={40} height={40}
                        className="w-10 h-10 rounded-lg object-cover" unoptimized />
                    )}
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                </td>
                <td className="text-sm capitalize">{p.category}</td>
                <td className="font-semibold text-sm">{formatCurrency(p.price)}</td>
                <td className="text-sm">{p.stock}</td>
                <td>{p.is_featured ? <Star className="text-amber-400" size={14} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                <td>
                  <div className="flex gap-1.5">
                    <button onClick={() => startEdit(p)} className="btn-outline btn-sm" title="Modifier"><Pencil size={12} /></button>
                    <button onClick={() => remove(p.id)} className="btn-sm btn-danger inline-flex items-center justify-center" title="Supprimer"><Trash2 size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
