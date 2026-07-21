'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Pencil, Trash2, Star, Save, LayoutGrid, List,
  Search, Archive, RotateCcw, AlertTriangle, Upload,
  ChevronUp, ChevronDown, GripVertical, PackagePlus, Calendar,
  ArrowDownCircle, ArrowUpCircle, Boxes,
} from 'lucide-react';
import type { Product, ProductCategory, StockMovementReason } from '@/types';
import { CATEGORY_LABELS, STOCK_MOVEMENT_REASON_LABELS } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/shared/ToastProvider';
import Dialog from '@/components/ui/Dialog';
import { getCurrentUserPermissionsAction } from '@/app/actions/authActions';
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
  restoreProductAction,
  purgeProductAction,
  reorderProductsAction,
  adjustProductStockAction,
} from '@/app/actions/productActions';

const CATEGORIES: ProductCategory[] = ['purificateurs', 'industriel', 'consommables'];

const FormSchema = z.object({
  name: z.string().min(2, 'Nom trop court').max(120),
  price: z.coerce.number().min(0, 'Prix invalide'),
  wholesale_price: z.coerce.number().min(0).optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
  stock: z.coerce.number().int().min(0),
  /**
   * Seuil d'alerte stock : valeur entière >= 0. Le formulaire l'affiche
   * comme input pour que l'admin puisse le régler. Par défaut 5 si non
   * renseigné (cf. ProductFormDialog.reset()).
   */
  stock_alert_threshold: z.coerce.number().int().min(0, 'Seuil invalide').optional(),
  category: z.enum(['purificateurs', 'industriel', 'consommables']),
  description: z.string().max(2000).optional(),
  is_featured: z.boolean().optional(),
  is_out_of_stock: z.boolean().optional(),
  is_archived: z.boolean().optional(),
  price_on_request: z.boolean().optional(),
});
type FormData = z.infer<typeof FormSchema>;

type ViewMode = 'table' | 'cards';
type Tab = 'active' | 'archived';

interface ProductFormDialogProps {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSaved: (p: Product) => void;
  /** Réservé au super admin : affichage + édition du prix d'achat en gros. */
  canEditWholesalePrice: boolean;
  /**
   * Demande d'ouverture de la modale « Mouvement de stock » depuis le champ
   * Stock de la fiche édition. Le parent remplace alors la modale produit par
   * la modale mouvement. En création (product === null) ce n'est jamais appelé.
   */
  onOpenMovement?: (product: Product) => void;
}

function ProductFormDialog({ open, product, onClose, onSaved, canEditWholesalePrice, onOpenMovement }: ProductFormDialogProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string>('');

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
  });
  const priceOnRequest = useWatch({ control, name: 'price_on_request', defaultValue: false });

  // Reset form on open / product change
  useEffect(() => {
    if (open) {
      if (product) {
        reset({
          name: product.name,
          price: product.price,
          wholesale_price: product.wholesale_price || 0,
          sort_order: product.sort_order ?? 0,
          stock: product.stock,
          stock_alert_threshold: product.stock_alert_threshold ?? 5,
          category: product.category,
          description: product.description ?? '',
          is_featured: product.is_featured,
          is_out_of_stock: !!product.is_out_of_stock,
          is_archived: !!product.is_archived,
          price_on_request: !!product.price_on_request,
        });
        setImageUrl(product.image_url || '');
      } else {
        reset({
          name: '',
          price: 0,
          wholesale_price: 0,
          sort_order: 0,
          stock: 0,
          stock_alert_threshold: 5,
          category: 'purificateurs',
          description: '',
          is_featured: false,
          is_out_of_stock: false,
          is_archived: false,
          price_on_request: false,
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
        // Prix d'achat en gros : champ réservé au super admin.
        // On conserve la valeur existante pour les non-admins (undefined = non touché).
        ...(canEditWholesalePrice
          ? { wholesale_price: data.wholesale_price || 0 }
          : product?.wholesale_price !== undefined
            ? { wholesale_price: product.wholesale_price }
            : {}),
        stock: data.stock,
        /**
         * Seuil d'alerte stock : on envoie la valeur du formulaire si elle est
         * définie, sinon on conserve la valeur existante (cas où le champ n'est
         * pas encore affiché). Pour un nouveau produit, défaut = 5.
         */
        stock_alert_threshold:
          data.stock_alert_threshold !== undefined && data.stock_alert_threshold !== null
            ? data.stock_alert_threshold
            : (product?.stock_alert_threshold ?? 5),
        category: data.category,
        description: data.description ?? null,
        is_featured: !!data.is_featured,
        is_out_of_stock: !!data.is_out_of_stock,
        is_archived: !!data.is_archived,
        price_on_request: !!data.price_on_request,
        sort_order: data.sort_order ?? 0,
        // Image : soit on garde l'URL deja en place, soit on envoie un data:
        // URL (uniquement en mock pour eviter l'upload Supabase Storage).
        image_url_local: imageUrl.startsWith('data:') ? imageUrl : null,
        image_url: imageUrl && !imageUrl.startsWith('data:') ? imageUrl : null,
        specs: product?.specs ?? [],
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={product ? 'Modifier le produit' : 'Nouveau produit'}
      subtitle={product ? product.id : 'Renseignez les informations ci-dessous'}
      zIndex={1100}
      size="full"
      maxHeight="tall"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="btn-outline flex-1 justify-center py-2.5"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={isSubmitting}
            className="btn-primary flex-1 justify-center py-2.5"
          >
            <Save size={14} /> {isSubmitting ? 'Enregistrement...' : (product ? 'Enregistrer' : 'Créer')}
          </button>
        </>
      }
    >
        <form id="product-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="sm:col-span-2 xl:col-span-3">
              <label className="form-label">Nom *</label>
              <input
                className="form-input"
                placeholder="Ex : Osmoseur Compact Premium"
                {...register('name')}
              />
              {errors.name && <p className="text-xs text-danger mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="form-label">Catégorie *</label>
              <select className="form-input" {...register('category')}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Stock *</label>
              {product ? (
                <>
                  <input
                    type="number"
                    min={0}
                    className="form-input opacity-70 cursor-not-allowed"
                    placeholder="0"
                    disabled
                    readOnly
                    aria-readonly="true"
                    title="Le stock se modifie uniquement via « Mouvement de stock »."
                    {...register('stock')}
                  />
                  <input type="hidden" {...register('stock')} />
                  <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    Stock actuel (lecture seule). Toute variation passe par
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenMovement) onOpenMovement(product);
                      }}
                      className="mx-1 underline font-semibold"
                      style={{ color: 'var(--primary-light)' }}
                    >
                      Mouvement de stock
                    </button>
                    (entrée, sortie, correction, perte…).
                  </p>
                </>
              ) : (
                <>
                  <input
                    type="number"
                    min={0}
                    className="form-input"
                    placeholder="0"
                    {...register('stock')}
                  />
                  {errors.stock && <p className="text-xs text-danger mt-1">{errors.stock.message}</p>}
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    Stock initial à la création du produit. Toute variation ultérieure passera par le bouton « Mouvement de stock ».
                  </p>
                </>
              )}
            </div>
            <div>
              <label className="form-label">Seuil d&apos;alerte stock</label>
              <input
                type="number"
                min={0}
                step={1}
                className="form-input"
                placeholder="5"
                {...register('stock_alert_threshold')}
              />
              {errors.stock_alert_threshold && (
                <p className="text-xs text-danger mt-1">{errors.stock_alert_threshold.message}</p>
              )}
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                Une alerte apparaît en boutique quand le stock passe sous ce seuil.
              </p>
            </div>
            <div>
              <label className="form-label">Ordre d&apos;affichage</label>
              <input
                type="number"
                min={0}
                step={10}
                className="form-input"
                placeholder="0"
                {...register('sort_order')}
              />
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                Plus la valeur est petite, plus le produit apparaît en haut.
              </p>
            </div>
            <div>
              <label className="form-label">Prix de vente (DH) {priceOnRequest ? '' : '*'}</label>
              <input
                type="number"
                step="0.01"
                min={0}
                className="form-input"
                placeholder={priceOnRequest ? 'Sur devis' : '1999'}
                disabled={priceOnRequest}
                {...register('price')}
              />
              {priceOnRequest && (
                <p className="text-[10px] mt-1 font-semibold" style={{ color: 'var(--ocean-600)' }}>
                  Le prix sera affiché « Sur devis » en boutique.
                </p>
              )}
              {!priceOnRequest && errors.price && <p className="text-xs text-danger mt-1">{errors.price.message}</p>}
            </div>
            {canEditWholesalePrice && (
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
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Réservé au super admin.
                </p>
              </div>
            )}
            <div className="sm:col-span-2 xl:col-span-3">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                rows={6}
                placeholder="Description courte du produit..."
                {...register('description')}
              />
            </div>
            <div className="sm:col-span-2 xl:col-span-3">
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
                      className="text-xs text-danger hover:opacity-80 self-start font-semibold"
                    >
                      Supprimer la photo
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="sm:col-span-2 xl:col-span-3 flex flex-wrap gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_featured')} />
                <span className="text-sm flex items-center gap-1">
                  <Star size={12} className="text-warning" /> Produit phare
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('price_on_request')} />
                <span className="text-sm flex items-center gap-1" style={{ color: 'var(--ocean-600)' }}>
                  💰 Prix sur devis
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_out_of_stock')} />
                <span className="text-sm text-danger font-semibold">Rupture de stock</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_archived')} />
                <span className="text-sm text-warning font-semibold">
                  Archivé (retirer de la boutique)
                </span>
              </label>
            </div>
          </div>
        </form>
    </Dialog>
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
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      subtitle={message}
      icon={<AlertTriangle size={18} className={danger ? 'text-danger' : 'text-warning'} />}
      zIndex={1100}
      size="sm"
      footer={
        <>
          <button type="button" onClick={onCancel} className="btn-outline flex-1 justify-center py-2.5">
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={(danger ? 'btn-primary btn-danger' : 'btn-primary') + ' flex-1 justify-center py-2.5'}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {/* Le contenu est intégré dans le Dialog via title/subtitle. Slot vide intentionnel. */}
    </Dialog>
  );
}

interface RestockDialogProps {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onRestocked: (
    updated: Product,
    event: {
      quantity: number;
      restock_date: string;
      reason: StockMovementReason;
      note: string | null;
    },
  ) => void;
}

/**
 * Motifs pour lesquels l'admin doit préciser le sens (entrée / sortie) :
 *  - correction : ajustement d'inventaire (positif ou négatif)
 *  - other      : motif libre (positif ou négatif)
 * Pour les autres motifs, le sens est imposé par le motif.
 */
const FREE_DIRECTION_REASONS: ReadonlySet<StockMovementReason> = new Set<StockMovementReason>([
  'correction',
  'other',
]);

/**
 * Modale de mouvement de stock : permet d'enregistrer une ENTRÉE (réassort,
 * retour client) ou une SORTIE (vente directe, perte) avec motif + note + date.
 *
 * Le stock initial reste inchangé : seul le compteur `stock` du produit est
 * incrémenté ou décrémenté, et chaque mouvement est journalisé dans
 * `product_restock_history`.
 */
function RestockDialog({ open, product, onClose, onRestocked }: RestockDialogProps) {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [reason, setReason] = useState<StockMovementReason>('restock');
  const [quantity, setQuantity] = useState<string>('');
  const [restockDate, setRestockDate] = useState<string>(today);
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Reset à l'ouverture / au changement de produit
  useEffect(() => {
    if (open) {
      setDirection('in');
      setReason('restock');
      setQuantity('');
      setRestockDate(new Date().toISOString().slice(0, 10));
      setNote('');
    }
  }, [open, product?.id]);

  // Quand le motif change, on recale la direction imposée par le motif
  // (les motifs "ambigus" correction/other conservent la direction courante).
  useEffect(() => {
    if (!open) return;
    if (reason === 'restock' || reason === 'return') setDirection('in');
    else if (reason === 'direct_sale' || reason === 'loss') setDirection('out');
  }, [reason, open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, submitting]);

  const parsedQty = Number(quantity);
  const qtyValid = quantity !== '' && Number.isFinite(parsedQty) && parsedQty > 0;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(restockDate);
  const noteRequired = reason === 'correction' || reason === 'other';
  const noteValid = !noteRequired || note.trim().length > 0;
  const canSubmit = !!product && qtyValid && dateValid && noteValid && !submitting;

  // Calcul du delta signé pour l'aperçu et l'envoi.
  const signedDelta = qtyValid ? (direction === 'in' ? Math.trunc(parsedQty) : -Math.trunc(parsedQty)) : 0;
  const newStockPreview = product && qtyValid
    ? Math.max(0, product.stock + signedDelta)
    : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !canSubmit) return;
    setSubmitting(true);
    try {
      const res = await adjustProductStockAction(product.id, {
        direction: direction === 'in' ? 1 : -1,
        quantity: Math.trunc(parsedQty),
        restock_date: restockDate,
        reason,
        note: note.trim() ? note.trim().slice(0, 500) : null,
      });
      if (res.success && res.product) {
        const sign = res.event.quantity > 0 ? '+' : '';
        toast(
          `Mouvement enregistré : ${sign}${res.event.quantity} → ${res.product.stock} en stock`,
          'success',
        );
        onRestocked(res.product, {
          quantity: res.event.quantity,
          restock_date: restockDate,
          reason,
          note: note.trim() ? note.trim().slice(0, 500) : null,
        });
        onClose();
      } else {
        toast(res.error || 'Erreur', 'error');
      }
    } catch (err: any) {
      toast(err?.message || 'Erreur inconnue', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const isFixedDirection = !FREE_DIRECTION_REASONS.has(reason);
  const isExitReason = reason === 'direct_sale' || reason === 'loss';

  return (
    <Dialog
      open={open}
      onClose={() => { if (!submitting) onClose(); }}
      title="Mouvement de stock"
      subtitle={
        product
          ? `${direction === 'in' ? 'Entrée' : 'Sortie'} de stock pour « ${product.name} »`
          : 'Sélectionnez un produit'
      }
      icon={<Boxes size={18} className="text-primary" />}
      zIndex={1100}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="btn-outline flex-1 justify-center py-2.5"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="restock-form"
            disabled={!canSubmit}
            className="btn-primary flex-1 justify-center py-2.5"
          >
            <PackagePlus size={14} />
            {submitting ? 'Enregistrement...' : 'Confirmer'}
          </button>
        </>
      }
    >
      <form id="restock-form" onSubmit={submit} className="space-y-4">
        {/* Aperçu stock actuel / nouveau stock */}
        <div
          className="rounded-xl px-3 py-2 text-xs"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Stock actuel</span>
            <span className="font-bold text-base">{product?.stock ?? 0}</span>
          </div>
          {newStockPreview !== null && product && (
            <div className="flex items-center justify-between mt-1 pt-1" style={{ borderTop: '1px dashed var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nouveau stock</span>
              <span
                className="font-bold text-base"
                style={{ color: direction === 'in' ? 'var(--success)' : (isExitReason ? 'var(--danger)' : 'var(--warning)') }}
              >
                {direction === 'in' ? '+' : '−'}
                {Math.abs(signedDelta)} → {newStockPreview}
              </span>
            </div>
          )}
        </div>

        {/* Sens du mouvement (entrée / sortie) — désactivé pour les motifs à sens imposé */}
        <div>
          <label className="form-label">Sens du mouvement</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection('in')}
              disabled={isFixedDirection && isExitReason}
              className="rounded-lg px-3 py-2 text-sm font-semibold border transition-colors flex items-center justify-center gap-2"
              style={{
                background: direction === 'in' ? 'var(--success)' : 'var(--bg-card)',
                color: direction === 'in' ? '#fff' : 'var(--text-secondary)',
                borderColor: direction === 'in' ? 'var(--success)' : 'var(--border)',
                opacity: isFixedDirection && isExitReason ? 0.4 : 1,
                cursor: isFixedDirection && isExitReason ? 'not-allowed' : 'pointer',
              }}
            >
              <ArrowDownCircle size={14} /> Entrée
            </button>
            <button
              type="button"
              onClick={() => setDirection('out')}
              disabled={isFixedDirection && !isExitReason}
              className="rounded-lg px-3 py-2 text-sm font-semibold border transition-colors flex items-center justify-center gap-2"
              style={{
                background: direction === 'out' ? 'var(--danger)' : 'var(--bg-card)',
                color: direction === 'out' ? '#fff' : 'var(--text-secondary)',
                borderColor: direction === 'out' ? 'var(--danger)' : 'var(--border)',
                opacity: isFixedDirection && !isExitReason ? 0.4 : 1,
                cursor: isFixedDirection && !isExitReason ? 'not-allowed' : 'pointer',
              }}
            >
              <ArrowUpCircle size={14} /> Sortie
            </button>
          </div>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
            {isFixedDirection
              ? `Le motif « ${STOCK_MOVEMENT_REASON_LABELS[reason]} » impose ce sens.`
              : 'Choisis le sens pour ce motif (entrée = +, sortie = −).'}
          </p>
        </div>

        {/* Motif du mouvement */}
        <div>
          <label className="form-label">Motif *</label>
          <select
            className="form-input"
            value={reason}
            onChange={(e) => setReason(e.target.value as StockMovementReason)}
            required
          >
            {(['restock', 'return', 'direct_sale', 'correction', 'loss', 'other'] as StockMovementReason[]).map((r) => (
              <option key={r} value={r}>
                {STOCK_MOVEMENT_REASON_LABELS[r]}
              </option>
            ))}
          </select>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
            Réassort fournisseur, retour client, vente directe, correction
            d&apos;inventaire, perte, ou autre motif.
          </p>
        </div>

        {/* Quantité + date */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="form-label">
              Quantité {direction === 'in' ? 'ajoutée' : 'retirée'} *
            </label>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              className="form-input"
              placeholder="Ex : 10"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              autoFocus
            />
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Toujours &gt; 0. Le signe est appliqué selon le sens ci-dessus.
            </p>
          </div>
          <div>
            <label className="form-label flex items-center gap-1.5">
              <Calendar size={12} /> Date du mouvement *
            </label>
            <input
              type="date"
              className="form-input"
              value={restockDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setRestockDate(e.target.value)}
              required
            />
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Date effective du mouvement.
            </p>
          </div>
        </div>

        {/* Commentaire / motif textuel */}
        <div>
          <label className="form-label">
            Commentaire {noteRequired ? '*' : '(optionnel)'}
          </label>
          <textarea
            className="form-input"
            rows={2}
            placeholder={
              noteRequired
                ? 'Justification obligatoire (correction d\'inventaire / autre)…'
                : 'Fournisseur, référence de lot, n° de retour client, remarque…'
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            required={noteRequired}
          />
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
            {noteRequired
              ? 'Obligatoire pour une correction d\'inventaire ou un motif « autre ».'
              : 'Recommandé : facilite le suivi (fournisseur, lot, n° de retour…).'}
          </p>
        </div>
      </form>
    </Dialog>
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
  // Modale d'approvisionnement : séparée de l'édition pour que le stock initial
  // reste inchangé — seul le compteur est incrémenté via cette action.
  const [restockOpen, setRestockOpen] = useState(false);
  const [restocking, setRestocking] = useState<Product | null>(null);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    message: string;
    danger?: boolean;
    confirmLabel?: string;
    onConfirm: () => Promise<void> | void;
  }>(null);
  // Drag-and-drop natif HTML5
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const toast = useToast();
  const [permissions, setPermissions] = useState<any>(null);
  const [role, setRole] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    getCurrentUserPermissionsAction().then(res => {
      if (res.success) {
        setPermissions(res.permissions);
        setRole(res.role || '');
      }
    });
  }, []);

  // Un superadmin ET un administrator peuvent tout éditer sur le catalogue
  // (les perms du profil sont passées en OR au cas où ils seraient à false).
  const canEdit = !permissions
    || role === 'admin'
    || role === 'administrator'
    || permissions.can_edit_products;
  // Seul le superadmin peut voir / modifier le prix d'achat en gros.
  const isSuperAdmin = role === 'admin';

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

  const openRestock = (p: Product) => {
    setRestocking(p);
    setRestockOpen(true);
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

  /**
   * Callback du RestockDialog : on aligne la state locale sur le produit
   * retourné par le serveur (nouveau stock) sans toucher aux autres champs.
   * L'historique est consultable côté serveur / futur écran dédié.
   */
  const onRestocked = (
    updated: Product,
    _event: {
      quantity: number;
      restock_date: string;
      reason: StockMovementReason;
      note: string | null;
    },
  ) => {
    setProducts(prev => {
      const idx = prev.findIndex(x => x.id === updated.id);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = { ...copy[idx], stock: updated.stock, updated_at: updated.updated_at };
      return copy;
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

  /**
   * Pousse l'ordre : met à jour le state local, persiste via l'action
   * serveur, puis déclenche un `router.refresh()` qui ré-exécute le
   * Server Component parent (liste complète refetchée depuis Supabase
   * avec le nouvel ordre) et re-passe `initialProducts` au client.
   *
   * Pas besoin de manipuler les sort_order des produits hors-filtrage :
   * le `revalidatePath` côté serveur invalide le cache Next, et
   * `router.refresh()` force le re-fetch de la liste globale.
   *
   * @param newVisibleOrder  liste des produits DANS LE NOUVEL ORDRE,
   *                        restreinte au sous-ensemble visible
   */
  const persistNewOrder = async (newVisibleOrder: Product[]) => {
    if (reordering) return;
    setReordering(true);
    try {
      // 1) Mise à jour optimiste : on réordonne la liste locale en gardant
      //    l'ordre relatif des produits non visibles.
      const visibleIds = new Set(newVisibleOrder.map(p => p.id));
      const hidden = products.filter(p => !visibleIds.has(p.id));
      const newLocalOrder = [...newVisibleOrder, ...hidden];
      // On conserve les sort_order EXISTANTS des produits cachés pour
      // ne pas les écraser inutilement (ils seront de toute façon
      // rafraîchis après le router.refresh).
      setProducts(newLocalOrder);

      // 2) Persistance serveur : on n'envoie QUE les produits visibles
      //    avec un sort_order = index * 10 dans la liste GLOBALE.
      //    Si on n'est pas filtré, newLocalOrder === products et tout va bien.
      //    Si on est filtré, on calcule les sort_order comme si la liste
      //    complète était [visible réordonné, ...hidden].
      const items = newLocalOrder.map((p, idx) => ({
        id: p.id,
        sort_order: idx * 10,
      }));

      const res = await reorderProductsAction(items);
      if (res.success) {
        toast('Ordre enregistré', 'success');
        // 3) Re-fetch depuis le serveur pour aligner la state locale sur la
        //    réalité DB (au cas où d'autres produits auraient bougé en //
        //    et pour éviter toute divergence entre l'ordre optimiste et
        //    l'ordre réel).
        router.refresh();
      } else {
        toast('Erreur : ' + res.error, 'error');
      }
    } finally {
      setReordering(false);
    }
  };

  /**
   * Déplace un produit d'une position vers le haut ou le bas dans la liste
   * actuellement filtrée, puis persiste le nouvel ordre.
   */
  const moveProduct = (id: string, direction: 'up' | 'down') => {
    const current = [...visibleProducts];
    const idx = current.findIndex(p => p.id === id);
    if (idx === -1) return;
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= current.length) return;
    const a = current[idx];
    const b = current[target];
    current[idx] = b;
    current[target] = a;
    void persistNewOrder(current);
  };

  // Handlers drag-and-drop HTML5
  const onDragStart = (e: React.DragEvent<HTMLTableRowElement>, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox a besoin d'un type MIME pour démarrer le drag
    try { e.dataTransfer.setData('text/plain', id); } catch { /* ignore */ }
  };
  const onDragOver = (e: React.DragEvent<HTMLTableRowElement>, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragOverId) setDragOverId(id);
  };
  const onDragLeave = (id: string) => {
    if (dragOverId === id) setDragOverId(null);
  };
  const onDrop = (e: React.DragEvent<HTMLTableRowElement>, dropId: string) => {
    e.preventDefault();
    setDragOverId(null);
    const srcId = dragId ?? e.dataTransfer.getData('text/plain');
    setDragId(null);
    if (!srcId || srcId === dropId) return;
    const current = [...visibleProducts];
    const srcIdx = current.findIndex(p => p.id === srcId);
    const dstIdx = current.findIndex(p => p.id === dropId);
    if (srcIdx === -1 || dstIdx === -1) return;
    const [moved] = current.splice(srcIdx, 1);
    current.splice(dstIdx, 0, moved);
    void persistNewOrder(current);
  };
  const onDragEnd = () => {
    setDragId(null);
    setDragOverId(null);
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
              {CATEGORY_LABELS[c]}
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
                {canEdit && tab === 'active' && <th style={{ width: '90px' }}>Ordre</th>}
                <th>Produit</th>
                <th>Catégorie</th>
                <th>Prix Vente</th>
                {isSuperAdmin && <th>Prix Gros</th>}
                <th>Stock</th>
                <th>Statuts</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((p, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === visibleProducts.length - 1;
                const isDragOver = dragOverId === p.id && dragId && dragId !== p.id;
                return (
                <tr
                  key={p.id}
                  draggable={canEdit && tab === 'active'}
                  onDragStart={canEdit && tab === 'active' ? (e) => onDragStart(e, p.id) : undefined}
                  onDragOver={canEdit && tab === 'active' ? (e) => onDragOver(e, p.id) : undefined}
                  onDragLeave={canEdit && tab === 'active' ? () => onDragLeave(p.id) : undefined}
                  onDrop={canEdit && tab === 'active' ? (e) => onDrop(e, p.id) : undefined}
                  onDragEnd={canEdit && tab === 'active' ? onDragEnd : undefined}
                  className={[
                    canEdit && tab === 'active' ? 'cursor-grab active:cursor-grabbing' : '',
                    isDragOver ? 'product-row-drop-target' : '',
                    dragId === p.id ? 'product-row-dragging' : '',
                  ].filter(Boolean).join(' ')}
                  style={isDragOver ? { boxShadow: 'inset 0 2px 0 0 var(--primary)' } : undefined}
                >
                  {canEdit && tab === 'active' && (
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveProduct(p.id, 'up')}
                          disabled={isFirst || reordering}
                          className="btn-icon"
                          title="Monter"
                          aria-label={`Monter ${p.name}`}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveProduct(p.id, 'down')}
                          disabled={isLast || reordering}
                          className="btn-icon"
                          title="Descendre"
                          aria-label={`Descendre ${p.name}`}
                        >
                          <ChevronDown size={14} />
                        </button>
                        <span
                          className="ml-1 text-[10px] inline-flex items-center"
                          style={{ color: 'var(--text-muted)' }}
                          title="Glisser-déposer pour réorganiser"
                        >
                          <GripVertical size={14} />
                        </span>
                      </div>
                    </td>
                  )}
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
                    {CATEGORY_LABELS[p.category]}
                  </td>
                  <td className="font-semibold text-sm">{formatCurrency(p.price)}</td>
                  {isSuperAdmin && (
                    <td className="font-semibold text-sm" style={{ color: 'var(--primary-light)' }}>
                      {p.wholesale_price ? formatCurrency(p.wholesale_price) : '—'}
                    </td>
                  )}
                  <td className="text-sm">{p.stock}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {p.is_featured && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-warning-soft font-bold">
                          Phare
                        </span>
                      )}
                      {p.is_out_of_stock && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-danger-soft font-bold">
                          Rupture
                        </span>
                      )}
                      {p.is_archived && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-soft font-bold">
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
                            onClick={() => openRestock(p)}
                            className="btn-sm inline-flex items-center justify-center"
                            style={{
                              background: 'var(--success-soft, rgba(16, 185, 129, 0.12))',
                              border: '1px solid var(--success)',
                              color: 'var(--success)',
                            }}
                            title={`Mouvement de stock pour « ${p.name} » (entrée / sortie avec motif + commentaire)`}
                            aria-label={`Mouvement de stock : ${p.name}`}
                          >
                            <PackagePlus size={12} />
                          </button>
                        )}
                        {!p.is_archived && (
                          <button
                            type="button"
                            onClick={() => askArchive(p)}
                            className="btn-sm inline-flex items-center justify-center bg-warning-soft"
                            style={{ border: '1px solid var(--warning)' }}
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
                              className="btn-sm inline-flex items-center justify-center bg-success-soft"
                              style={{ border: '1px solid var(--success)' }}
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
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        // VUE CARTES
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleProducts.map(p => (
            <article key={p.id} className="glass-card overflow-hidden flex flex-col" style={{ transform: 'none' }}>
              <div
                className="relative flex items-center justify-center p-3"
                style={{ background: 'var(--bg-card)', height: '160px' }}
              >
                {p.image_url ? (
                  <Image
                    src={p.image_url}
                    alt={p.name}
                    fill
                    className="object-contain p-1"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    unoptimized
                  />
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
                  {CATEGORY_LABELS[p.category]}
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
                          onClick={() => openRestock(p)}
                          className="btn-sm inline-flex items-center justify-center"
                          style={{
                            background: 'var(--success-soft, rgba(16, 185, 129, 0.12))',
                            border: '1px solid var(--success)',
                            color: 'var(--success)',
                          }}
                          aria-label={`Mouvement de stock : ${p.name}`}
                          title="Mouvement de stock"
                        >
                          <PackagePlus size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => askArchive(p)}
                          className="btn-sm inline-flex items-center justify-center bg-warning-soft"
                          style={{ border: '1px solid var(--warning)' }}
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
                          className="btn-sm flex-1 justify-center bg-success-soft"
                          style={{ border: '1px solid var(--success)' }}
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
        canEditWholesalePrice={isSuperAdmin}
        onOpenMovement={(p) => {
          // Ferme la fiche édition, ouvre la modale mouvement de stock à sa place.
          setDialogOpen(false);
          setEditing(null);
          setRestocking(p);
          setRestockOpen(true);
        }}
      />

      {/* Modale approvisionnement (incrément de stock + journalisation) */}
      <RestockDialog
        open={restockOpen}
        product={restocking}
        onClose={() => setRestockOpen(false)}
        onRestocked={onRestocked}
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