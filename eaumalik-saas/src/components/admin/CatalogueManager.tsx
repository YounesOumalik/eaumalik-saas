'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Star, X, Save } from 'lucide-react';
import Image from 'next/image';
import type { Product, ProductCategory } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/shared/ToastProvider';
import { getCurrentUserPermissionsAction } from '@/app/actions/authActions';

const CATEGORIES: ProductCategory[] = ['purificateurs', 'industriel', 'consommables'];

import { createProductAction, updateProductAction, deleteProductAction } from '@/app/actions/productActions';

const FormSchema = z.object({
  name: z.string().min(2),
  price: z.coerce.number().min(0),
  wholesale_price: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0),
  category: z.enum(['purificateurs', 'industriel', 'consommables']),
  description: z.string().max(500).optional(),
  is_featured: z.boolean().optional(),
  is_out_of_stock: z.boolean().optional(),
  is_archived: z.boolean().optional(),
});
type FormData = z.infer<typeof FormSchema>;

export default function CatalogueManager({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [editing, setEditing] = useState<Product | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const toast = useToast();

  const [permissions, setPermissions] = useState<any>(null);
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    getCurrentUserPermissionsAction().then(res => {
      if (res.success) {
        setPermissions(res.permissions);
        setRole(res.role || '');
      }
    });
  }, []);

  const canEdit = !permissions || role === 'admin' || permissions.can_edit_products;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (editing) {
      const res = await updateProductAction(editing.id, {
        name: data.name,
        price: data.price,
        wholesale_price: data.wholesale_price,
        stock: data.stock,
        category: data.category,
        description: data.description ?? null,
        is_featured: !!data.is_featured,
        is_out_of_stock: !!data.is_out_of_stock,
        is_archived: !!data.is_archived,
        image_url: imageUrl || null,
      });

      if (res.success && res.product) {
        setProducts(prev =>
          prev.map(p => p.id === editing.id ? res.product! : p)
        );
        toast('Produit mis à jour', 'success');
      } else {
        toast('Erreur lors de la mise à jour: ' + res.error, 'error');
      }
    } else {
      const res = await createProductAction({
        name: data.name,
        slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        price: data.price,
        wholesale_price: data.wholesale_price,
        stock: data.stock,
        category: data.category,
        description: data.description ?? null,
        is_featured: !!data.is_featured,
        is_out_of_stock: !!data.is_out_of_stock,
        is_archived: !!data.is_archived,
        image_url: imageUrl || 'https://picsum.photos/seed/' + Math.random().toString(36).slice(2, 8) + '/400/400',
        specs: [],
        stock_alert_threshold: 5,
        filter_lifespan_months: data.category === 'consommables' ? 12 : null,
      });

      if (res.success && res.product) {
        setProducts(prev => [res.product!, ...prev]);
        toast('Produit ajouté', 'success');
      } else {
        toast('Erreur lors de l\'ajout: ' + res.error, 'error');
      }
    }
    setEditing(null);
    setImageUrl('');
    reset();
  };

  const startEdit = (p: Product) => {
    setEditing(p);
    setImageUrl(p.image_url || '');
    reset({
      name: p.name,
      price: p.price,
      wholesale_price: p.wholesale_price || 0,
      stock: p.stock,
      category: p.category,
      description: p.description ?? '',
      is_featured: p.is_featured,
      is_out_of_stock: !!p.is_out_of_stock,
      is_archived: !!p.is_archived,
    });
  };

  const remove = async (id: string) => {
    if (!confirm('Supprimer ce produit définitivement ?')) return;
    const res = await deleteProductAction(id);
    if (res.success) {
      setProducts(prev => prev.filter(p => p.id !== id));
      toast('Produit supprimé', 'success');
    } else {
      toast('Erreur lors de la suppression: ' + res.error, 'error');
    }
  };

  const resetForm = () => {
    setEditing(null);
    setImageUrl('');
    reset({
      name: '',
      price: 0,
      wholesale_price: 0,
      stock: 0,
      category: 'purificateurs',
      description: '',
      is_featured: false,
      is_out_of_stock: false,
      is_archived: false,
    });
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-extrabold text-xl">Gestion du Catalogue</h2>
        {canEdit && (
          <button onClick={resetForm} className="btn-primary btn-sm">
            <Plus size={14} /> Nouveau produit
          </button>
        )}
      </div>

      {canEdit && (
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
            <label className="form-label">Prix de vente (DH) *</label>
            <input type="number" step="0.01" className="form-input" {...register('price')} />
          </div>
          <div>
            <label className="form-label">Prix d&apos;achat en gros (DH) *</label>
            <input type="number" step="0.01" className="form-input" {...register('wholesale_price')} />
          </div>
          <div>
            <label className="form-label">Stock *</label>
            <input type="number" className="form-input" {...register('stock')} />
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={3} {...register('description')} />
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">Photo du produit</label>
            <div className="flex items-center gap-4 mt-1">
              <div className="w-16 h-16 rounded-xl border border-[color:var(--border)] overflow-hidden relative bg-[color:var(--bg-card)] flex items-center justify-center flex-shrink-0">
                {imageUrl ? (
                  <Image src={imageUrl} alt="Preview" fill className="object-cover" unoptimized />
                ) : (
                  <span className="text-[10px] text-center px-1" style={{ color: 'var(--text-muted)' }}>Pas d&apos;image</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="text-xs cursor-pointer text-[color:var(--text-secondary)]
                    file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
                    file:text-xs file:font-semibold file:bg-[color:var(--primary)]
                    file:text-white hover:file:bg-[color:var(--primary-light)]
                    file:cursor-pointer"
                />
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-xs text-red-400 hover:text-red-300 self-start font-medium"
                  >
                    Supprimer la photo
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-4 mt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('is_featured')} />
              <span className="text-sm flex items-center gap-1"><Star size={12} className="text-amber-400" /> Produit phare</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('is_out_of_stock')} />
              <span className="text-sm text-red-400 font-semibold">Rupture de stock</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('is_archived')} />
              <span className="text-sm text-amber-500 font-semibold">Archivé (retirer de la boutique)</span>
            </label>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn-primary">
            <Save size={14} /> {editing ? 'Enregistrer' : 'Ajouter'}
          </button>
          {editing && (
            <button type="button" onClick={resetForm} className="btn-outline">
              <X size={14} /> Annuler
            </button>
          )}
        </div>
      </form>
      )}

      <div className="glass-card overflow-x-auto" style={{ transform: 'none' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Categorie</th>
              <th>Prix Vente</th>
              <th>Prix Gros</th>
              <th>Stock</th>
              <th>Statuts</th>
              {canEdit && <th>Actions</th>}
            </tr>
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
                <td className="font-semibold text-sm text-cyan-400">{p.wholesale_price ? formatCurrency(p.wholesale_price) : '—'}</td>
                <td className="text-sm">{p.stock}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {p.is_featured && <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-bold">Phare</span>}
                    {p.is_out_of_stock && <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 font-bold">Rupture</span>}
                    {p.is_archived && <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-500/20 text-gray-400 font-bold">Archivé</span>}
                    {!p.is_featured && !p.is_out_of_stock && !p.is_archived && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </div>
                </td>
                {canEdit && (
                  <td>
                    <div className="flex gap-1.5">
                      <button onClick={() => startEdit(p)} className="btn-outline btn-sm" title="Modifier"><Pencil size={12} /></button>
                      <button onClick={() => remove(p.id)} className="btn-sm btn-danger inline-flex items-center justify-center" title="Supprimer"><Trash2 size={12} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
