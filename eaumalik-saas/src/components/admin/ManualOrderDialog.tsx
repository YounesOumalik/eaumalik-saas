'use client';

/**
 * Modale "Nouvelle commande manuelle" (saisie par un agent).
 *
 * Inspirée visuellement du formulaire de promotion (`CrmNews`) :
 *   - Bandeau d'en-tête avec le contexte (parrain automatique + agent)
 *   - Sections pliables : Informations client → Produits → Récap
 *   - Sélecteur de produits avec recherche + quantités (même UX que la sélection
 *     de produits d'une promotion)
 *
 * Logique parrainage (cf. consigne produit 2026-07-15) :
 *   Le parrain de la nouvelle commande est AUTOMATIQUEMENT le compte
 *   utilisateur actuellement connecté (l'agent qui saisit). Cette info
 *   est affichée clairement en haut du formulaire, en lecture seule.
 *
 * À la soumission :
 *   - `createManualOrderAction` côté serveur crée/met à jour le client
 *     (par téléphone), crée la commande, et lie `referred_by` au profil
 *     parrain de l'agent. Voir `src/app/actions/ordersActions.ts`.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag,
  Plus,
  Trash2,
  Package,
  Search,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Phone,
  MapPin,
  StickyNote,
  Gift,
  CheckCircle2,
  AlertCircle,
  User,
  Save,
} from 'lucide-react';
import Dialog from '@/components/ui/Dialog';
import { useToast } from '@/components/shared/ToastProvider';
import { formatCurrency } from '@/lib/utils';
import {
  createManualOrderAction,
  getReferrerProfileAction,
  getCatalogProductsLiteAction,
  type ReferrerProfile,
} from '@/app/actions/ordersActions';

// ============================================================================
// Types locaux
// ============================================================================
type ProductLite = {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url: string | null;
  stock: number;
};

type ItemSelection = {
  productId: string;
  quantity: number;
};

// ============================================================================
// Composant principal
// ============================================================================
export default function ManualOrderDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** Callback invoqué après création réussie — la page parente s'occupe
   *  typiquement de recharger la liste des commandes. */
  onCreated?: (orderNumber: string) => void;
}) {
  const toast = useToast();

  // -- Client ----------------------------------------------------------------
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientCity, setClientCity] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [notes, setNotes] = useState('');

  // -- Produits --------------------------------------------------------------
  const [items, setItems] = useState<ItemSelection[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // -- Parrain automatique (= agent connecté) -------------------------------
  const [referrer, setReferrer] = useState<ReferrerProfile | null>(null);
  const [referrerLoaded, setReferrerLoaded] = useState(false);

  // -- Sections pliables ----------------------------------------------------
  const [clientOpen, setClientOpen] = useState(true);
  const [productsOpen, setProductsOpen] = useState(true);

  // ============================================================================
  // Chargement initial (produits + parrain) — en PARALLÈLE pour minimiser
  // le temps d'affichage de la modale (cf. getCatalogProductsLiteAction :
  // projection stricte + cache mémoire 60s, donc réponse quasi-instantanée
  // au 2e appel). `Promise.allSettled` évite qu'un échec de l'une bloque
  // l'autre.
  // ============================================================================
  useEffect(() => {
    if (!open) return;
    // Reset partiel à chaque ouverture
    setClientName('');
    setClientPhone('');
    setClientCity('');
    setClientAddress('');
    setNotes('');
    setItems([]);
    setProductSearch('');
    setSubmitting(false);

    Promise.allSettled([
      getCatalogProductsLiteAction(),
      getReferrerProfileAction(),
    ]).then(([prodRes, refRes]) => {
      if (prodRes.status === 'fulfilled' && prodRes.value.success) {
        setProducts(prodRes.value.products ?? []);
      }
      setProductsLoaded(true);
      if (refRes.status === 'fulfilled') {
        setReferrer(refRes.value);
      }
      setReferrerLoaded(true);
    });
  }, [open]);

  // ============================================================================
  // Dérivés
  // ============================================================================
  const productsById = useMemo(() => {
    const map = new Map<string, ProductLite>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const selectedProductsTotal = useMemo(() => {
    return items.reduce((sum, sel) => {
      const p = productsById.get(sel.productId);
      if (!p) return sum;
      return sum + p.price * Math.max(1, sel.quantity);
    }, 0);
  }, [items, productsById]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  // ============================================================================
  // Handlers produits
  // ============================================================================
  const addItem = (productId: string) => {
    if (items.some(s => s.productId === productId)) return;
    setItems(prev => [...prev, { productId, quantity: 1 }]);
  };

  const updateQty = (productId: string, qty: number) => {
    setItems(prev =>
      prev.map(s =>
        s.productId === productId ? { ...s, quantity: Math.max(1, qty) } : s
      )
    );
  };

  const removeItem = (productId: string) => {
    setItems(prev => prev.filter(s => s.productId !== productId));
  };

  // ============================================================================
  // Validation
  // ============================================================================
  const phoneOk = /^0[6-7][0-9]{8}$/.test(clientPhone);
  const canSubmit =
    !submitting &&
    clientName.trim().length >= 3 &&
    phoneOk &&
    clientCity.trim().length >= 1 &&
    clientAddress.trim().length >= 5 &&
    items.length >= 1;

  // ============================================================================
  // Soumission
  // ============================================================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      toast('Veuillez compléter les informations client et ajouter au moins un produit.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createManualOrderAction({
        client_name: clientName.trim(),
        client_phone: clientPhone.trim(),
        client_address: clientAddress.trim(),
        client_city: clientCity.trim(),
        notes: notes.trim() || undefined,
        items: items.map(i => ({ product_id: i.productId, quantity: i.quantity })),
      });
      if (!res.success) {
        toast(res.error ?? 'Création de la commande impossible.', 'error');
        return;
      }
      toast(
        `Commande ${res.order?.order_number} créée — parrain ${res.referrer_code ?? '?'}.`,
        'success'
      );
      onCreated?.(res.order?.order_number ?? '');
      onClose();
    } catch (e: any) {
      toast(e?.message ?? 'Erreur réseau.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================================
  // Rendu
  // ============================================================================
  return (
    <Dialog
      open={open}
      onClose={() => (!submitting ? onClose() : undefined)}
      title="Nouvelle commande manuelle"
      subtitle="Saisie au comptoir ou par téléphone"
      icon={<ShoppingBag size={18} />}
      size="2xl"
      dismissible={!submitting}
      maxHeight="tall"
      footer={
        <div className="flex flex-col sm:flex-row gap-2 w-full">
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
            form="manual-order-form"
            disabled={!canSubmit}
            className="btn-primary flex-1 justify-center py-2.5 inline-flex items-center gap-1.5"
          >
            <Save size={14} />
            {submitting ? 'Création…' : 'Enregistrer la commande'}
          </button>
        </div>
      }
    >
      <form
        id="manual-order-form"
        onSubmit={handleSubmit}
        className="space-y-4"
        style={{ transform: 'none' }}
      >
        {/* ===================== BANDEAU PARRAIN AUTOMATIQUE ===================== */}
        <div
          className="p-3 sm:p-4 rounded-xl border-2 flex items-center gap-3"
          style={{
            borderColor: 'rgba(167,139,250,0.45)',
            background: 'rgba(167,139,250,0.10)',
          }}
        >
          <span
            aria-hidden="true"
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(167,139,250,0.25)', color: '#a78bfa' }}
          >
            <Gift size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="font-display font-bold text-sm flex items-center gap-1.5"
              style={{ color: '#a78bfa' }}
            >
              Parrain automatique
              {!referrerLoaded && (
                <span className="text-[10px] opacity-70">(chargement…)</span>
              )}
            </div>
            {referrer ? (
              <div className="text-xs mt-1 leading-snug" style={{ color: 'var(--text)' }}>
                <span className="font-semibold">{referrer.full_name}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {' '}· {referrer.email}
                </span>
                {referrer.role && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    {' '}· rôle <span className="font-mono">{referrer.role}</span>
                  </span>
                )}
                <br />
                <span style={{ color: 'var(--text-muted)' }}>
                  Code parrain&nbsp;:{' '}
                  <span className="font-mono font-semibold" style={{ color: '#a78bfa' }}>
                    {referrer.referral_code}
                  </span>
                </span>
                <span className="block mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Ce compte sera automatiquement défini comme parrain du client lors de
                  l&apos;enregistrement de la commande (sauf si le client a déjà un parrain
                  attribué — on ne l&apos;écrase pas).
                </span>
              </div>
            ) : (
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Chargement du profil parrain…
              </div>
            )}
          </div>
        </div>

        {/* ===================== SECTION CLIENT ===================== */}
        <section className="border border-[color:var(--border)] rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setClientOpen(o => !o)}
            className="w-full flex items-center justify-between p-4 bg-[color:var(--bg-surface)] hover:bg-[color:var(--bg-card-hover)] transition-colors"
          >
            <span className="flex items-center gap-2 font-display font-bold text-base">
              <UserPlus size={18} className="text-primary-light" />
              Informations client
              <span
                className="text-xs font-normal px-2 py-0.5 rounded-full border border-[color:var(--border)] bg-[color:var(--bg-card)]"
              >
                {clientName.trim() ? clientName.trim() : 'Nouveau client'}
              </span>
            </span>
            {clientOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {clientOpen && (
            <div className="p-4 sm:p-6 space-y-4 bg-[color:var(--bg)]">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Renseignez les informations du client pour qui vous saisissez la commande.
                Le compte client sera créé (ou mis à jour) automatiquement.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label flex items-center gap-1">
                    <User size={12} /> Nom complet *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder="Ex : Ahmed Benani"
                    required
                    minLength={3}
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="form-label flex items-center gap-1">
                    <Phone size={12} /> Téléphone *
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    value={clientPhone}
                    onChange={e => setClientPhone(e.target.value)}
                    placeholder="06XXXXXXXX ou 07XXXXXXXX"
                    pattern="^0[6-7][0-9]{8}$"
                    inputMode="numeric"
                    maxLength={10}
                    required
                  />
                  {clientPhone && !phoneOk && (
                    <p className="text-[11px] mt-1 flex items-center gap-1 text-red-500">
                      <AlertCircle size={11} /> Format marocain attendu : 06/07XXXXXXXX.
                    </p>
                  )}
                  {phoneOk && (
                    <p className="text-[11px] mt-1 flex items-center gap-1 text-success">
                      <CheckCircle2 size={11} /> Numéro valide.
                    </p>
                  )}
                </div>
                <div>
                  <label className="form-label flex items-center gap-1">
                    <MapPin size={12} /> Ville *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={clientCity}
                    onChange={e => setClientCity(e.target.value)}
                    placeholder="Ex : Casablanca"
                    required
                  />
                </div>
                <div>
                  <label className="form-label flex items-center gap-1">
                    <MapPin size={12} /> Adresse complète *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={clientAddress}
                    onChange={e => setClientAddress(e.target.value)}
                    placeholder="N°, rue, quartier…"
                    required
                    minLength={5}
                    maxLength={200}
                  />
                </div>
              </div>

              <div>
                <label className="form-label flex items-center gap-1">
                  <StickyNote size={12} /> Note (optionnelle)
                </label>
                <textarea
                  className="form-input min-h-[5rem]"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ex : client venu en boutique, préfère livraison samedi matin…"
                  maxLength={500}
                />
              </div>
            </div>
          )}
        </section>

        {/* ===================== SECTION PRODUITS ===================== */}
        <section className="border border-[color:var(--border)] rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setProductsOpen(o => !o)}
            className="w-full flex items-center justify-between p-4 bg-[color:var(--bg-surface)] hover:bg-[color:var(--bg-card-hover)] transition-colors"
          >
            <span className="flex items-center gap-2 font-display font-bold text-base">
              <Package size={18} className="text-primary-light" />
              Produits commandés
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-[color:var(--bg-card)] border border-[color:var(--border)]">
                {items.length} sélectionné{items.length > 1 ? 's' : ''}
              </span>
              {items.length > 0 && (
                <span
                  className="text-xs font-bold"
                  style={{ color: 'var(--primary-light)' }}
                >
                  · {formatCurrency(selectedProductsTotal)}
                </span>
              )}
            </span>
            {productsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {productsOpen && (
            <div className="p-4 sm:p-6 space-y-4 bg-[color:var(--bg)]">
              {/* Produits déjà sélectionnés */}
              {items.length > 0 && (
                <ul className="space-y-2">
                  {items.map(sel => {
                    const p = productsById.get(sel.productId);
                    if (!p) return null;
                    return (
                      <li
                        key={sel.productId}
                        className="flex items-center gap-3 p-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-surface)]"
                      >
                        {p.image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-12 h-12 rounded object-cover border border-[color:var(--border)]"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-[color:var(--bg-card)] border border-[color:var(--border)] flex items-center justify-center">
                            <Package size={14} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{p.name}</div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {p.category} · {formatCurrency(p.price)} l&apos;unité
                          </div>
                        </div>
                        <label className="text-xs flex items-center gap-1">
                          Qté
                          <input
                            type="number"
                            min="1"
                            max={p.stock || 999}
                            value={sel.quantity}
                            onChange={e => updateQty(sel.productId, Number(e.target.value))}
                            className="w-16 form-input py-1 text-sm"
                          />
                        </label>
                        <div className="text-sm font-bold text-right w-28">
                          {formatCurrency(p.price * sel.quantity)}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(sel.productId)}
                          className="p-2 rounded-lg text-red-500 hover:bg-red-500/10"
                          title="Retirer ce produit"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Recherche */}
              <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[12rem]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                  <input
                    type="text"
                    className="form-input pl-9 py-2 text-sm"
                    placeholder="Rechercher un produit à inclure…"
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                  />
                </div>
              </div>

              {!productsLoaded && (
                <div className="text-center text-xs py-4" style={{ color: 'var(--text-muted)' }}>
                  Chargement du catalogue…
                </div>
              )}
              {productsLoaded && products.length === 0 && (
                <div className="text-center text-xs py-4" style={{ color: 'var(--text-muted)' }}>
                  Catalogue vide. Ajoutez d&apos;abord des produits depuis l&apos;administration.
                </div>
              )}

              <div className="max-h-60 overflow-y-auto grid sm:grid-cols-2 gap-2 pr-1">
                {filteredProducts.map(p => {
                  const already = items.some(s => s.productId === p.id);
                  return (
                    <button
                      type="button"
                      key={p.id}
                      disabled={already}
                      onClick={() => addItem(p.id)}
                      className={`text-left p-2 rounded-lg border transition-colors flex items-center gap-3 ${
                        already
                          ? 'border-success/40 bg-success-soft/40 opacity-70 cursor-not-allowed'
                          : 'border-[color:var(--border)] hover:border-[color:var(--primary)] hover:bg-[color:var(--primary)]/5'
                      }`}
                    >
                      {p.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-10 h-10 rounded object-cover border border-[color:var(--border)]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-[color:var(--bg-surface)] border border-[color:var(--border)] flex items-center justify-center">
                          <Package size={14} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{p.name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {formatCurrency(p.price)} · stock {p.stock}
                        </div>
                      </div>
                      {already ? (
                        <span className="text-[10px] font-bold text-success">AJOUTÉ</span>
                      ) : (
                        <Plus size={16} className="text-primary-light" />
                      )}
                    </button>
                  );
                })}
                {productsLoaded && products.length > 0 && filteredProducts.length === 0 && (
                  <div
                    className="col-span-full text-center text-xs py-4"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Aucun produit ne correspond à votre recherche.
                  </div>
                )}
              </div>

              {items.length === 0 && (
                <div
                  className="text-xs p-3 rounded-lg flex items-center gap-2"
                  style={{ background: 'rgba(245,158,11,0.10)', color: '#fbbf24' }}
                >
                  <AlertCircle size={14} />
                  Ajoutez au moins un produit pour pouvoir enregistrer la commande.
                </div>
              )}
            </div>
          )}
        </section>

        {/* ===================== RÉCAP ===================== */}
        <section
          className="border border-[color:var(--border)] rounded-2xl overflow-hidden"
          aria-label="Récapitulatif"
        >
          <div className="p-4 bg-[color:var(--bg-surface)]">
            <span className="font-display font-bold text-base flex items-center gap-2">
              <ShoppingBag size={18} className="text-primary-light" />
              Récapitulatif
            </span>
          </div>
          <div className="p-4 sm:p-6 bg-[color:var(--bg)] space-y-2">
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-card)]">
                <div
                  className="text-xs uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Sous-total produits
                </div>
                <div className="font-display font-extrabold text-lg mt-1">
                  {formatCurrency(selectedProductsTotal)}
                </div>
              </div>
              <div className="p-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-card)]">
                <div
                  className="text-xs uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Livraison
                </div>
                <div className="font-display font-extrabold text-lg mt-1">
                  {selectedProductsTotal >= 2000 ? 'Offerte' : formatCurrency(50)}
                </div>
              </div>
              <div className="p-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-card)]">
                <div
                  className="text-xs uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Total
                </div>
                <div
                  className="font-display font-extrabold text-lg mt-1"
                  style={{ color: 'var(--primary-light)' }}
                >
                  {formatCurrency(selectedProductsTotal + (selectedProductsTotal >= 2000 ? 0 : 50))}
                </div>
              </div>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              La commande sera créée avec le statut <strong>En attente</strong> et
              apparaîtra immédiatement dans la liste. Vous pourrez ensuite la faire
              avancer comme n&apos;importe quelle autre commande.
            </p>
          </div>
        </section>
      </form>
    </Dialog>
  );
}