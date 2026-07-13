'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Pencil, Trash2, Star, X, Save, LayoutGrid, List,
  Search, Archive, RotateCcw, AlertTriangle, Upload,
} from 'lucide-react';
import type { Product, ProductCategory } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/shared/ToastProvider';
import { getCurrentUserPermissionsAction } from '@/app/actions/authActions';
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
  restoreProductAction,
  purgeProductAction,
} from '@/app/actions/productActions';

const CATEGORIES: ProductCategory[] = ['purificateurs', 'industriel', 'consommables'];

const FormSchema = z.object({
  name: z.string().min(2, 'Nom trop court').max(120),
  price: z.coerce.number().min(0, 'Prix invalide'),
  wholesale_price: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().int().min(0),
  category: z.enum(['purificateurs', 'industriel', 'consommables']),
  description: z.string().max(2000).optional(),
  is_featured: z.boolean().optional(),
  is_out_of_stock: z.boolean().optional(),
  is_archived: z.boolean().optional(),
});
type FormData = z.infer<typeof FormSchema>;

type ViewMode = 'table' | 'cards';
type Tab = 'active' | 'archived';

interface ProductFormDialogProps {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSaved: (p: Product) => void;
}

function ProductFormDialog({ open, product, onClose, onSaved }: ProductFormDialogProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string>('');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
  });

  // Reset form on open / product change
  useEffect(() => {
    if (open) {
      if (product) {
        reset({
          name: product.name,
          price: product.price,
          wholesale_price: product.wholesale_price || 0,
          stock: product.stock,
          category: product.category,
          description: product.description ?? '',
          is_featured: product.is_featured,
          is_out_of_stock: !!product.is_out_of_stock,
          is_archived: !!product.is_archived,
        });
        setImageUrl(product.image_url || '');
      } else {
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
        setImageUrl('');
      }
    }
  }, [open, product, reset]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        name: data.name,
        price: data.price,
        wholesale_price: data.wholesale_price || 0,
        stock: data.stock,
        category: data.category,
        description: data.description ?? null,
        is_featured: !!data.is_featured,
        is_out_of_stock: !!data.is_out_of_stock,
        is_archived: !!data.is_archived,
        // Image : soit on garde l'URL deja en place, soit on envoie un data:
        // URL (uniquement en mock pour eviter l'upload Supabase Storage).
        image_url_local: imageUrl.startsWith('data:') ? imageUrl : null,
        image_url: imageUrl && !imageUrl.startsWith('data:') ? imageUrl : null,
        specs: product?.specs ?? [],
        stock_alert_threshold: product?.stock_alert_threshold ?? 5,
        filter_lifespan_months: data.category === 'consommables' ? 12 : null,
      };

      const res = product
        ? await updateProductAction(product.id, payload)
        : await createProductAction(payload);

      if (res.success && res.product) {
        toast(product ? 'Produit mis à jour' : 'Produit ajouté', 'success');
        onSaved(res.product);
        onClose();
      } else {
        toast(res.error || 'Erreur', 'error');
      }
    } catch (err: any) {
      toast(err?.message || 'Erreur inconnue', 'error');
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4 animate-modal-in"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-dialog-title"
    >
      <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ transform: 'none' }}>
        <div className="flex items-center justify-between p-5 border-b border-[color:var(--border)] sticky top-0 bg-[color:var(--bg-surface)] z-10">
          <div>
            <h3 id="product-dialog-title" className="font-display font-extrabold text-lg">
              {product ? 'Modifier le produit' : 'Nouveau produit'}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {product ? product.id : 'Renseignez les informations ci-dessous'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:opacity-80"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="form-label">Nom *</label>
              <input
                className="form-input"
                placeholder="Ex : Osmoseur Compact Premium"
                {...register('name')}
              />
              {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="form-label">Catégorie *</label>
              <select className="form-input" {...register('category')}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c === 'purificateurs' ? 'Purificateurs' : c === 'industriel' ? 'Industriel' : 'Consommables'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Stock *</label>
              <input
                type="number"
                min={0}
                className="form-input"
                placeholder="0"
                {...register('stock')}
              />
              {errors.stock && <p className="text-xs text-red-400 mt-1">{errors.stock.message}</p>}
            </div>
            <div>
              <label className="form-label">Prix de vente (DH) *</label>
              <input
                type="number"
                step="0.01"
                min={0}
                className="form-input"
                placeholder="1999"
                {...register('price')}
              />
              {errors.price && <p className="text-xs text-red-400 mt-1">{errors.price.message}</p>}
            </div>
            <div>
              <label className="form-label">Prix d&apos;achat en gros (DH)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                className="form-input"
                placeholder="0"
                {...register('wholesale_price')}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Description courte du produit..."
                {...register('description')}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Photo du produit</label>
              <div className="flex items-center gap-4 mt-1">
                <div
                  className="w-20 h-20 rounded-xl overflow-hidden relative flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                >
                  {imageUrl ? (
                    <Image src={imageUrl} alt="Aperçu" fill className="object-cover" unoptimized />
                  ) : (
                    <Upload size={20} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <input
                    ref={fileInputRef}
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
                      className="text-xs text-red-400 hover:text-red-300 self-start font-semibold"
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
                <span className="text-sm flex items-center gap-1">
                  <Star size={12} className="text-amber-400" /> Produit phare
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_out_of_stock')} />
                <span className="text-sm text-red-400 font-semibold">Rupture de stock</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_archived')} />
                <span className="text-sm text-amber-500 font-semibold">
                  Archivé (retirer de la boutique)
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-[color:var(--border)]">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary disabled:opacity-50"
            >
              <Save size={14} /> {isSubmitting ? 'Enregistrement...' : (product ? 'Enregistrer' : 'Créer')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-outline"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmer', danger, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4 animate-modal-in"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="glass-card max-w-md w-full p-6" style={{ transform: 'none' }}>
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: danger ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)' }}
          >
            <AlertTriangle size={18} className={danger ? 'text-red-400' : 'text-amber-400'} />
          </div>
          <div>
            <h3 className="font-display font-bold text-base">{title}</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {message}
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onCancel} className="btn-outline">
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={danger ? 'btn-primary btn-danger' : 'btn-primary'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CatalogueManager({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [view, setView] = useState<ViewMode>('table');
  const [tab, setTab] = useState<Tab>('active');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProductCategory>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    message: string;
    danger?: boolean;
    confirmLabel?: string;
    onConfirm: () => Promise<void> | void;
  }>(null);

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

  // Filtrage local
  const visibleProducts = useMemo(() => {
    let list = products;
    // Filtre onglet
    if (tab === 'active') list = list.filter(p => !p.is_archived);
    else list = list.filter(p => p.is_archived);
    // Filtre categorie
    if (categoryFilter !== 'all') list = list.filter(p => p.category === categoryFilter);
    // Filtre recherche
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, tab, categoryFilter, search]);

  const archivedCount = useMemo(() => products.filter(p => p.is_archived).length, [products]);
  const activeCount = products.length - archivedCount;

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setDialogOpen(true);
  };

  const onSaved = (p: Product) => {
    setProducts(prev => {
      const idx = prev.findIndex(x => x.id === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = p;
        return copy;
      }
      return [p, ...prev];
    });
  };

  const askArchive = (p: Product) => {
    setConfirm({
      title: 'Archiver ce produit ?',
      message: `« ${p.name} » sera retiré de la boutique mais restera récupérable depuis l'onglet Archive.`,
      confirmLabel: 'Archiver',
      onConfirm: async () => {
        const res = await deleteProductAction(p.id);
        if (res.success && res.product) {
          setProducts(prev => prev.map(x => (x.id === p.id ? res.product! : x)));
          toast('Produit archivé', 'success');
        } else {
          toast('Erreur : ' + res.error, 'error');
        }
        setConfirm(null);
      },
    });
  };

  const askPurge = (p: Product) => {
    setConfirm({
      title: 'Supprimer définitivement ?',
      message: `« ${p.name} » sera supprimé définitivement. Cette action est irréversible.`,
      danger: true,
      confirmLabel: 'Supprimer définitivement',
      onConfirm: async () => {
        const res = await purgeProductAction(p.id);
        if (res.success) {
          setProducts(prev => prev.filter(x => x.id !== p.id));
          toast('Produit supprimé définitivement', 'success');
        } else {
          toast('Erreur : ' + res.error, 'error');
        }
        setConfirm(null);
      },
    });
  };

  const restore = async (p: Product) => {
    const res = await restoreProductAction(p.id);
    if (res.success && res.product) {
      setProducts(prev => prev.map(x => (x.id === p.id ? res.product! : x)));
      toast('Produit restauré', 'success');
    } else {
      toast('Erreur : ' + res.error, 'error');
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display font-extrabold text-xl">Gestion du Catalogue</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {activeCount} produit{activeCount > 1 ? 's' : ''} actif{activeCount > 1 ? 's' : ''} ·{' '}
            {archivedCount} archivé{archivedCount > 1 ? 's' : ''}
          </p>
        </div>
        {canEdit && tab === 'active' && (
          <button onClick={openCreate} className="btn-primary btn-sm">
            <Plus size={14} /> Nouveau produit
          </button>
        )}
      </div>

      {/* Tabs + Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`px-4 py-2 text-sm font-semibold transition-all ${
              tab === 'active' ? 'text-white' : ''
            }`}
            style={{
              background: tab === 'active' ? 'var(--primary)' : 'transparent',
              color: tab === 'active' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            Actifs ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setTab('archived')}
            className={`px-4 py-2 text-sm font-semibold transition-all flex items-center gap-1.5 ${
              tab === 'archived' ? '' : ''
            }`}
            style={{
              background: tab === 'archived' ? 'var(--primary)' : 'transparent',
              color: tab === 'archived' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <Archive size={12} /> Archives ({archivedCount})
          </button>
        </div>

        <div className="flex-1 min-w-[180px]">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input pl-9"
              placeholder="Rechercher un produit..."
              aria-label="Rechercher un produit"
            />
          </div>
        </div>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value as 'all' | ProductCategory)}
          className="form-input"
          aria-label="Filtrer par catégorie"
          style={{ width: 'auto', minWidth: 160 }}
        >
          <option value="all">Toutes catégories</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>
              {c === 'purificateurs' ? 'Purificateurs' : c === 'industriel' ? 'Industriel' : 'Consommables'}
            </option>
          ))}
        </select>

        <div className="inline-flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => setView('table')}
            aria-label="Vue tableau"
            aria-pressed={view === 'table'}
            className="px-2.5 py-2 transition-colors"
            style={{
              background: view === 'table' ? 'var(--primary)' : 'transparent',
              color: view === 'table' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <List size={14} />
          </button>
          <button
            type="button"
            onClick={() => setView('cards')}
            aria-label="Vue cartes"
            aria-pressed={view === 'cards'}
            className="px-2.5 py-2 transition-colors"
            style={{
              background: view === 'cards' ? 'var(--primary)' : 'transparent',
              color: view === 'cards' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      {visibleProducts.length === 0 ? (
        <div className="glass-card p-12 text-center" style={{ transform: 'none' }}>
          <i
            className="fa-solid fa-box-open text-5xl mb-4 inline-block"
            style={{ color: 'var(--text-muted)' }}
            aria-hidden="true"
          />
          <p style={{ color: 'var(--text-muted)' }}>
            {tab === 'archived'
              ? 'Aucun produit archivé pour le moment.'
              : 'Aucun produit ne correspond à votre recherche.'}
          </p>
          {tab === 'active' && search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)' }}
            >
              Réinitialiser la recherche
            </button>
          )}
        </div>
      ) : view === 'table' ? (
        <div className="glass-card overflow-x-auto" style={{ transform: 'none' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                <th>Prix Vente</th>
                <th>Prix Gros</th>
                <th>Stock</th>
                <th>Statuts</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {p.image_url && (
                        <Image
                          src={p.image_url}
                          alt={p.name}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                          unoptimized
                        />
                      )}
                      <span className="text-sm font-medium">{p.name}</span>
                    </div>
                  </td>
                  <td className="text-sm capitalize">
                    {p.category === 'purificateurs' ? 'Purificateur' : p.category === 'industriel' ? 'Industriel' : 'Consommable'}
                  </td>
                  <td className="font-semibold text-sm">{formatCurrency(p.price)}</td>
                  <td className="font-semibold text-sm text-cyan-400">
                    {p.wholesale_price ? formatCurrency(p.wholesale_price) : '—'}
                  </td>
                  <td className="text-sm">{p.stock}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {p.is_featured && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-bold">
                          Phare
                        </span>
                      )}
                      {p.is_out_of_stock && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 font-bold">
                          Rupture
                        </span>
                      )}
                      {p.is_archived && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-500/20 text-gray-400 font-bold">
                          Archivé
                        </span>
                      )}
                      {!p.is_featured && !p.is_out_of_stock && !p.is_archived && (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </div>
                  </td>
                  {canEdit && (
                    <td>
                      <div className="flex gap-1.5">
                        {!p.is_archived && (
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="btn-outline btn-sm"
                            title="Modifier"
                            aria-label={`Modifier ${p.name}`}
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                        {!p.is_archived && (
                          <button
                            type="button"
                            onClick={() => askArchive(p)}
                            className="btn-sm inline-flex items-center justify-center"
                            style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}
                            title="Archiver"
                            aria-label={`Archiver ${p.name}`}
                          >
                            <Archive size={12} />
                          </button>
                        )}
                        {p.is_archived && (
                          <>
                            <button
                              type="button"
                              onClick={() => restore(p)}
                              className="btn-sm inline-flex items-center justify-center"
                              style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}
                              title="Restaurer"
                              aria-label={`Restaurer ${p.name}`}
                            >
                              <RotateCcw size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => askPurge(p)}
                              className="btn-sm btn-danger inline-flex items-center justify-center"
                              title="Supprimer définitivement"
                              aria-label={`Supprimer ${p.name}`}
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // VUE CARTES
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleProducts.map(p => (
            <article key={p.id} className="glass-card overflow-hidden flex flex-col" style={{ transform: 'none' }}>
              <div
                className="aspect-video relative flex items-center justify-center"
                style={{ background: 'var(--bg-card)' }}
              >
                {p.image_url ? (
                  <Image src={p.image_url} alt={p.name} fill className="object-cover" unoptimized />
                ) : (
                  <i className="fa-solid fa-droplet text-3xl" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                )}
                <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                  {p.is_featured && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/90 text-white">
                      Phare
                    </span>
                  )}
                  {p.is_archived && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-700/90 text-white">
                      Archivé
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4 flex flex-col flex-1">
                <h4 className="font-display font-bold text-sm line-clamp-2 mb-1">{p.name}</h4>
                <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-muted)' }}>
                  {p.category === 'purificateurs' ? 'Purificateur' : p.category === 'industriel' ? 'Industriel' : 'Consommable'}
                </p>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold gradient-text">{formatCurrency(p.price)}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Stock : {p.stock}
                  </span>
                </div>
                {canEdit && (
                  <div className="flex gap-2 mt-auto">
                    {!p.is_archived ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="btn-outline btn-sm flex-1 justify-center"
                        >
                          <Pencil size={12} /> Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => askArchive(p)}
                          className="btn-sm inline-flex items-center justify-center"
                          style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}
                          aria-label={`Archiver ${p.name}`}
                          title="Archiver"
                        >
                          <Archive size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => restore(p)}
                          className="btn-sm flex-1 justify-center"
                          style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}
                        >
                          <RotateCcw size={12} /> Restaurer
                        </button>
                        <button
                          type="button"
                          onClick={() => askPurge(p)}
                          className="btn-sm btn-danger inline-flex items-center justify-center"
                          aria-label={`Supprimer ${p.name}`}
                          title="Supprimer définitivement"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modale produit (création / édition) */}
      <ProductFormDialog
        open={dialogOpen}
        product={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={onSaved}
      />

      {/* Confirmation */}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        danger={confirm?.danger}
        confirmLabel={confirm?.confirmLabel}
        onConfirm={async () => { if (confirm) await confirm.onConfirm(); }}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}