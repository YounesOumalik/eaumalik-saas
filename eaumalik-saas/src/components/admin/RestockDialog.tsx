'use client';

import { useEffect, useState } from 'react';
import {
  Boxes, ArrowDownCircle, ArrowUpCircle, PackagePlus, Calendar, MapPin,
} from 'lucide-react';
import type { Product, StockMovementReason, Location } from '@/types';
import { STOCK_MOVEMENT_REASON_LABELS } from '@/types';
import Dialog from '@/components/ui/Dialog';
import { useToast } from '@/components/shared/ToastProvider';
import { adjustProductStockAction } from '@/app/actions/productActions';

interface RestockDialogProps {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  /**
   * Callback appelé après un mouvement réussi avec le produit mis à jour
   * (côté client) et les détails du mouvement. Le parent peut soit mettre
   * à jour son state local, soit `window.location.reload()` pour ré-fetch
   * depuis Supabase / le mock store.
   */
  onRestocked?: (
    updated: Product,
    event: {
      quantity: number;
      restock_date: string;
      reason: StockMovementReason;
      note: string | null;
    },
  ) => void;
  /**
   * Catalogue de localités parmi lesquelles choisir (cf. migration 0014).
   * Si vide/absent, le sélecteur est masqué et le mouvement reste global.
   * Filtre de visibilité déjà appliqué côté serveur (cf. getVisibleLocationsForUser).
   */
  locations?: Location[];
  /** Localité pré-sélectionnée à l'ouverture (ex. depuis l'onglet Inventaire). */
  defaultLocationId?: string | null;
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
 *
 * Réutilisable depuis l'écran `/admin/stocks` (dashboard) et depuis
 * `/admin/catalogue` (modification d'un produit).
 */
export default function RestockDialog({
  open, product, onClose, onRestocked, locations, defaultLocationId,
}: RestockDialogProps) {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [reason, setReason] = useState<StockMovementReason>('restock');
  const [quantity, setQuantity] = useState<string>('');
  const [restockDate, setRestockDate] = useState<string>(today);
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  /** Localité impactée. `null` = mouvement global (legacy, sans localité). */
  const [localityId, setLocalityId] = useState<string>(defaultLocationId ?? '');

  const showLocalitySelector = !!locations && locations.length > 0;
  // Localité effective à utiliser (si le user choisit `''` on retombe sur null).
  const effectiveLocalityId = showLocalitySelector ? (localityId || null) : null;

  useEffect(() => {
    if (open) {
      setDirection('in');
      setReason('restock');
      setQuantity('');
      setRestockDate(new Date().toISOString().slice(0, 10));
      setNote('');
      // Pré-remplir avec la localité par défaut (cas typique : ouvert depuis
      // l'onglet Inventaire sur une localité précise).
      setLocalityId(defaultLocationId ?? '');
    }
  }, [open, product?.id, defaultLocationId]);

  useEffect(() => {
    if (!open) return;
    if (reason === 'restock' || reason === 'return') setDirection('in');
    else if (reason === 'direct_sale' || reason === 'loss') setDirection('out');
  }, [reason, open]);

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
  const canSubmit = !!product && qtyValid && dateValid && noteValid && !submitting
    // Si le sélecteur localité est visible, on exige un choix. Si le catalogue
    // est vide, on retombe sur le mode global (sélecteur masqué).
    && (!showLocalitySelector || !!effectiveLocalityId);

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
        locality_id: effectiveLocalityId,
      });
      if (res.success && res.product) {
        const sign = res.event.quantity > 0 ? '+' : '';
        const locSuffix = effectiveLocalityId
          ? ` à la localité ${locations?.find((l) => l.id === effectiveLocalityId)?.code ?? ''}`
          : ' (stock global)';
        toast(
          `Mouvement enregistré : ${sign}${res.event.quantity}${locSuffix} → ${res.product.stock} en stock global`,
          'success',
        );
        if (onRestocked) {
          onRestocked(res.product, {
            quantity: res.event.quantity,
            restock_date: restockDate,
            reason,
            note: note.trim() ? note.trim().slice(0, 500) : null,
          });
        }
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

        {showLocalitySelector && (
          <div>
            <label className="form-label flex items-center gap-1.5">
              <MapPin size={12} /> Localité impactée *
            </label>
            <select
              className="form-input"
              value={localityId}
              onChange={(e) => setLocalityId(e.target.value)}
              required
            >
              <option value="">— Choisir une localité —</option>
              {locations!.filter((l) => !l.is_archived && l.is_active).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.name} ({l.type})
                </option>
              ))}
            </select>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Le mouvement sera appliqué à cette localité ; le stock global du produit sera recalculé automatiquement.
            </p>
          </div>
        )}

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
