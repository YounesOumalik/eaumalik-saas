'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Send, Newspaper, Upload, X, Tag, Users, Package, ChevronDown,
  ChevronUp, Search, Trash2, Plus, CalendarClock, MapPin, Check,
  Pencil, Save, XCircle,
} from 'lucide-react';
import {
  publishNewsAction,
  updateNewsFromCrmAction,
  getAvailableProductsForNewsAction,
  getAvailableClientsForNewsAction,
} from '@/app/actions/clientActions';
import { useToast } from '@/components/shared/ToastProvider';
import { formatCurrency } from '@/lib/utils';
import type { News } from '@/types';

// ============================================================================
// Types locaux du formulaire
// ============================================================================
type ProductLite = {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url: string | null;
  stock: number;
};
type ClientLite = {
  id: string;
  full_name: string;
  email: string;
  city: string | null;
};

type ProductSelection = {
  productId: string;
  quantity: number;
};

// ============================================================================
// Props publiques
// ============================================================================
type CrmNewsProps = {
  /**
   * Mode de publication : `true` = promotion, `false` = annonce.
   * Optionnel — si non fourni, le composant gère son propre état interne.
   * Permet au parent (ex. `PublicationsManager`) de piloter le mode via
   * des boutons clairement distincts affichés en haut de la page.
   */
  isPromotion?: boolean;
  setIsPromotion?: React.Dispatch<React.SetStateAction<boolean>>;
  /**
   * Si défini, le formulaire passe en mode édition et pré-remplit tous les
   * champs avec les valeurs de cette actualité. La soumission appelle
   * alors `updateNewsFromCrmAction` au lieu de `publishNewsAction`.
   */
  editingItem?: News | null;
  /**
   * Callback invoqué après une soumission réussie (création ou édition).
   * En mode édition, le parent utilise typiquement ce callback pour
   * basculer l'UI en mode lecture et rafraîchir la liste.
   */
  onSaved?: (saved: News) => void;
  /**
   * Callback pour annuler le mode édition (ex. bouton "Annuler").
   */
  onCancelEdit?: () => void;
};

/** Formate une date ISO en "YYYY-MM-DD" pour <input type="date">. */
function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

// ============================================================================
// Composant principal
// ============================================================================
export default function CrmNews({
  isPromotion: externalIsPromotion,
  setIsPromotion: externalSetIsPromotion,
  editingItem = null,
  onSaved,
  onCancelEdit,
}: CrmNewsProps = {}) {
  // -- Champs de base --------------------------------------------------------
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [publishing, setPublishing] = useState(false);

  // -- Ciblage destinataires --------------------------------------------------
  const [targetAll, setTargetAll] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('__ALL__');
  const [clientsDropdownOpen, setClientsDropdownOpen] = useState(false);
  const clientsDropdownRef = useRef<HTMLDivElement>(null);
  const [clientsLoaded, setClientsLoaded] = useState(false);

  // -- Promotion (peut être piloté depuis le parent via les props) -----------
  const [internalIsPromotion, internalSetIsPromotion] = useState(true);
  const isPromotion = externalIsPromotion ?? internalIsPromotion;
  const setIsPromotion = externalSetIsPromotion ?? internalSetIsPromotion;
  const [price, setPrice] = useState<string>('');
  const [originalPrice, setOriginalPrice] = useState<string>('');
  const [productSelections, setProductSelections] = useState<ProductSelection[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // -- Section repliable : ciblage & promotion ------------------------------
  const [targetsOpen, setTargetsOpen] = useState(true);
  const [promoOpen, setPromoOpen] = useState(true);

  // -- Validité --------------------------------------------------------------
  const [validUntil, setValidUntil] = useState('');

  const toast = useToast();

  // ============================================================================
  // Chargement initial des listes (produits + clients)
  // ============================================================================
  useEffect(() => {
    getAvailableProductsForNewsAction()
      .then(res => {
        if (res.success) setProducts(res.products);
        setProductsLoaded(true);
      })
      .catch(() => setProductsLoaded(true));

    getAvailableClientsForNewsAction()
      .then(res => {
        if (res.success) setClients(res.clients);
        setClientsLoaded(true);
      })
      .catch(() => setClientsLoaded(true));
  }, []);

  // ============================================================================
  // Dérivés : prix catalogue des produits sélectionnés & total
  // ============================================================================
  const productsById = useMemo(() => {
    const map = new Map<string, ProductLite>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const selectedProductsTotal = useMemo(() => {
    return productSelections.reduce((sum, sel) => {
      const p = productsById.get(sel.productId);
      if (!p) return sum;
      return sum + p.price * Math.max(1, sel.quantity);
    }, 0);
  }, [productSelections, productsById]);

  const promoPriceNum = useMemo(() => {
    const v = Number(price.replace(',', '.'));
    return Number.isFinite(v) && v > 0 ? v : null;
  }, [price]);

  const promoOriginalPriceNum = useMemo(() => {
    if (originalPrice.trim() === '') return selectedProductsTotal;
    const v = Number(originalPrice.replace(',', '.'));
    return Number.isFinite(v) && v > 0 ? v : selectedProductsTotal;
  }, [originalPrice, selectedProductsTotal]);

  const discountPct = useMemo(() => {
    if (!promoPriceNum || !promoOriginalPriceNum || promoOriginalPriceNum <= 0) return null;
    return Math.max(0, Math.round((1 - promoPriceNum / promoOriginalPriceNum) * 100));
  }, [promoPriceNum, promoOriginalPriceNum]);

  // ============================================================================
  // Handlers
  // ============================================================================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const toggleClient = (id: string) => {
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const clearClients = () => setSelectedUserIds([]);

  /**
   * Coche uniquement les clients actuellement filtrés (ville + recherche).
   * Préserve les sélections existantes hors de la vue filtrée.
   */
  const selectAllFiltered = () => {
    setSelectedUserIds(prev => {
      const ids = new Set(prev);
      filteredClients.forEach(c => ids.add(c.id));
      return Array.from(ids);
    });
  };

  const removeClient = (id: string) => {
    setSelectedUserIds(prev => prev.filter(x => x !== id));
  };

  // Villes uniques triées alphabétiquement (locale FR).
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    clients.forEach(c => {
      const city = (c.city ?? '').trim();
      if (city) set.add(city);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [clients]);

  // Nombre de clients par ville (pour "(n)" dans le <select>).
  const cityCounts = useMemo(() => {
    const map = new Map<string, number>();
    clients.forEach(c => {
      const city = (c.city ?? '').trim();
      if (city) map.set(city, (map.get(city) ?? 0) + 1);
    });
    return map;
  }, [clients]);

  const filteredClients = useMemo(() => {
    let result = clients;
    // Filtre par ville d'abord (réduit fortement le volume affiché)
    if (cityFilter !== '__ALL__') {
      result = result.filter(c => (c.city ?? '').trim() === cityFilter);
    }
    // Puis recherche texte (nom ou email)
    const q = clientSearch.trim().toLowerCase();
    if (q) {
      result = result.filter(c =>
        (c.full_name ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [clients, cityFilter, clientSearch]);

  // Clients actuellement cochés (pour les chips de sélection).
  const selectedClientsData = useMemo(() => {
    return selectedUserIds
      .map(id => clients.find(c => c.id === id))
      .filter((c): c is ClientLite => Boolean(c));
  }, [selectedUserIds, clients]);

  // Ferme la liste déroulante au clic en dehors.
  useEffect(() => {
    if (!clientsDropdownOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        clientsDropdownRef.current &&
        !clientsDropdownRef.current.contains(e.target as Node)
      ) {
        setClientsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [clientsDropdownOpen]);

  // ============================================================================
  // Pré-remplissage en mode édition
  // ============================================================================
  useEffect(() => {
    if (!editingItem) return;
    setTitle(editingItem.title ?? '');
    setContent(editingItem.content ?? '');
    setImageUrl(editingItem.image_url ?? '');
    setTargetAll(editingItem.target_all !== false);
    setSelectedUserIds(Array.isArray(editingItem.target_user_ids) ? editingItem.target_user_ids : []);
    const isPromo = editingItem.is_promotion === true;
    setIsPromotion(isPromo);
    setPrice(
      typeof editingItem.price === 'number' && editingItem.price > 0
        ? String(editingItem.price)
        : ''
    );
    setOriginalPrice(
      typeof editingItem.original_price === 'number' && editingItem.original_price > 0
        ? String(editingItem.original_price)
        : ''
    );
    setProductSelections(
      Array.isArray(editingItem.product_ids)
        ? editingItem.product_ids.map(pid => ({ productId: pid, quantity: 1 }))
        : []
    );
    setValidUntil(isoToDateInput(editingItem.valid_until));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingItem?.id]);

  // Si la ville précédemment sélectionnée n'existe plus, on retombe sur "Toutes".
  useEffect(() => {
    if (cityFilter !== '__ALL__' && !availableCities.includes(cityFilter)) {
      setCityFilter('__ALL__');
    }
  }, [availableCities, cityFilter]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  const addProductSelection = (productId: string) => {
    if (productSelections.some(s => s.productId === productId)) return;
    setProductSelections(prev => [...prev, { productId, quantity: 1 }]);
  };

  const updateQty = (productId: string, qty: number) => {
    setProductSelections(prev =>
      prev.map(s => s.productId === productId ? { ...s, quantity: Math.max(1, qty) } : s)
    );
  };

  const removeProduct = (productId: string) => {
    setProductSelections(prev => prev.filter(s => s.productId !== productId));
  };

  // ============================================================================
  // Publication
  // ============================================================================
  // Pour les promotions, le ciblage est forcé à "tous les clients" :
  // elles apparaissent sur la landing page + la boutique, donc visibles
  // par tout le monde sans sélection manuelle.
  const canPublish =
    title.trim().length >= 3 &&
    content.trim().length >= 3 &&
    !publishing &&
    (isPromotion || targetAll || selectedUserIds.length >= 1);

  const targetLabel = isPromotion
    ? '📢 Visible par tous (landing + boutique)'
    : targetAll
      ? '📢 Tous les clients'
      : selectedUserIds.length === 0
        ? '⚠️ Aucun client sélectionné'
        : `👥 ${selectedUserIds.length} client(s) ciblé(s)`;

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || publishing) return;
    if (!isPromotion && !targetAll && selectedUserIds.length === 0) {
      toast('Sélectionnez au moins un client destinataire.', 'error');
      return;
    }

    setPublishing(true);

    // Pour une promotion : ciblage forcé à "tous les clients"
    // (visible dans le carrousel landing + la boutique).
    const effectiveTargetAll = isPromotion ? true : targetAll;

    const payload = {
      title: title.trim(),
      content: content.trim(),
      imageUrl: imageUrl || undefined,
      // Ciblage
      targetAll: effectiveTargetAll,
      targetUserIds: effectiveTargetAll ? [] : selectedUserIds,
      // Promotion
      isPromotion,
      price: isPromotion ? promoPriceNum : null,
      originalPrice: isPromotion ? promoOriginalPriceNum : null,
      productIds: productSelections.map(s => s.productId),
      validUntil: validUntil ? new Date(validUntil).toISOString() : null,
    };

    const res = editingItem
      ? await updateNewsFromCrmAction(editingItem.id, payload)
      : await publishNewsAction(payload);

    if (res.success) {
      if (editingItem) {
        toast(
          isPromotion
            ? '✏️ Promotion mise à jour.'
            : '✏️ Actualité mise à jour.',
          'success'
        );
        onSaved?.(res.news as News);
      } else {
        toast(
          isPromotion
            ? '🎉 Promotion publiée ! Elle apparaît dans le carrousel de la landing.'
            : 'Actualité publiée avec succès !',
          'success'
        );
        // Reset complet (uniquement en mode création)
        setTitle('');
        setContent('');
        setImageUrl('');
        setTargetAll(true);
        setSelectedUserIds([]);
        setIsPromotion(true);
        setPrice('');
        setOriginalPrice('');
        setProductSelections([]);
        setValidUntil('');
        onSaved?.(res.news as News);
      }
    } else {
      toast('Erreur : ' + res.error, 'error');
    }
    setPublishing(false);
  };

  // ============================================================================
  // Rendu
  // ============================================================================
  return (
    <>
      <form
        onSubmit={handlePublish}
        className="glass-card p-6 sm:p-8 max-w-4xl space-y-6"
        style={{ transform: 'none' }}
      >
        {/* ===================== BANDEAU MODE ÉDITION ===================== */}
        {editingItem && (
          <div className="flex items-center justify-between gap-3 p-3 sm:p-4 rounded-xl border-2 border-primary/40 bg-primary/5">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
                <Pencil size={16} />
              </span>
              <div className="min-w-0">
                <div className="font-display font-bold text-sm">Mode édition</div>
                <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  Vous modifiez « {editingItem.title} »
                  {editingItem.is_archived === true ? ' (archivée)' : ''}
                </div>
              </div>
            </div>
            {onCancelEdit && (
              <button
                type="button"
                onClick={onCancelEdit}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[color:var(--border)] bg-[color:var(--bg-surface)] hover:bg-[color:var(--bg)]"
              >
                <XCircle size={14} /> Annuler
              </button>
            )}
          </div>
        )}

        {/* ===================== BLOC TITRE + CONTENU ===================== */}
        <section className="space-y-4">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            {isPromotion ? (
              <Tag size={18} className="text-warning" />
            ) : (
              <Newspaper size={18} className="text-primary-light" />
            )}
            {isPromotion ? 'Contenu de la promotion' : 'Contenu de l\u2019annonce'}
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {isPromotion
              ? "Rédigez la communication associée à votre offre. La promotion apparaîtra dans le carrousel défilant de la landing page."
              : "Rédigez votre communication. Les actualités publiées apparaissent immédiatement dans l'espace client des destinataires choisis."}
          </p>
          <div>
            <label className="form-label">
              {isPromotion ? 'Titre de la promotion *' : 'Titre de l\u2019annonce *'}
            </label>
            <input
              type="text"
              required
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={isPromotion
                ? 'Ex: -20% sur les recharges de filtres ce mois-ci !'
                : "Ex: Nouvelle ouverture d'horaires samedi matin"}
            />
          </div>
          <div>
            <label className="form-label">
              {isPromotion ? 'Contenu de la promotion *' : 'Contenu de l\u2019annonce *'}
            </label>
            <textarea
              required
              rows={6}
              className="form-input min-h-[10rem]"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={isPromotion
                ? "Écrivez le message de la promotion... Décrivez l'offre, la durée, les conditions."
                : 'Écrivez le message complet ici... Décrivez le contexte, la raison, les destinataires.'}
            />
          </div>

          <div>
            <label className="form-label">Photo d&apos;illustration (Optionnel)</label>
            <div className="flex gap-4 items-center mt-1 flex-wrap">
              <label className="cursor-pointer btn-outline py-2 px-3 text-xs flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-card)]">
                <Upload size={14} /> Choisir une photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              {imageUrl && (
                <div className="relative w-20 h-20 rounded border border-[color:var(--border)] overflow-hidden">
                  <img src={imageUrl} alt="Aperçu" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white font-bold"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ===================== CIBLAGE DESTINATAIRES ===================== */}
        {/* Masqué pour les promotions : visibles sur la landing page + boutique
            (tous les clients). Le ciblage reste pertinent uniquement pour les
            annonces, où l'envoi se fait via l'espace client des destinataires. */}
        {!isPromotion && (
        <section className="border border-[color:var(--border)] rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setTargetsOpen(!targetsOpen)}
            className="w-full flex items-center justify-between p-4 bg-[color:var(--bg-surface)] hover:bg-[color:var(--bg-card-hover)] transition-colors"
          >
            <span className="flex items-center gap-2 font-display font-bold text-base">
              <Users size={18} className="text-primary-light" /> Ciblage destinataires
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-[color:var(--bg-card)] border border-[color:var(--border)]">
                {targetLabel}
              </span>
            </span>
            {targetsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {targetsOpen && (
            <div className="p-4 sm:p-6 space-y-4 bg-[color:var(--bg)]">
              <div className="grid sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    targetAll
                      ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/5'
                      : 'border-[color:var(--border)] hover:border-[color:var(--border)]/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="target-mode"
                    checked={targetAll}
                    onChange={() => setTargetAll(true)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-bold text-sm">📢 Tous les clients</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Envoi broadcast à tous vos clients inscrits.
                    </div>
                  </div>
                </label>
                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    !targetAll
                      ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/5'
                      : 'border-[color:var(--border)] hover:border-[color:var(--border)]/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="target-mode"
                    checked={!targetAll}
                    onChange={() => setTargetAll(false)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-bold text-sm">🎯 Clients ciblés</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Sélection manuelle : {selectedUserIds.length} client(s) coché(s).
                    </div>
                  </div>
                </label>
              </div>

              {!targetAll && (
                <div className="border border-[color:var(--border)] rounded-xl p-4 bg-[color:var(--bg-card)] space-y-4">
                  {/* ============== Filtres : ville + recherche ============== */}
                  <div className="grid sm:grid-cols-[1fr_1.4fr] gap-3">
                    <div>
                      <label className="form-label text-xs flex items-center gap-1">
                        <MapPin size={12} /> Filtrer par ville
                      </label>
                      <select
                        className="form-input py-2 text-sm"
                        value={cityFilter}
                        onChange={e => setCityFilter(e.target.value)}
                        disabled={!clientsLoaded}
                      >
                        <option value="__ALL__">
                          Toutes les villes ({clients.length})
                        </option>
                        {availableCities.map(city => (
                          <option key={city} value={city}>
                            {city} ({cityCounts.get(city) ?? 0})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label text-xs flex items-center gap-1">
                        <Search size={12} /> Recherche
                      </label>
                      <div className="relative">
                        <Search
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none"
                        />
                        <input
                          type="text"
                          className="form-input pl-9 py-2 text-sm"
                          placeholder="Nom ou email..."
                          value={clientSearch}
                          onChange={e => setClientSearch(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ============== Chips des clients déjà cochés ============== */}
                  {selectedClientsData.length > 0 && (
                    <div className="border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/5 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold flex items-center gap-1.5">
                          <Check size={12} className="text-primary-light" />
                          {selectedClientsData.length} client
                          {selectedClientsData.length > 1 ? 's' : ''} sélectionné
                          {selectedClientsData.length > 1 ? 's' : ''}
                        </span>
                        <button
                          type="button"
                          onClick={clearClients}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Tout effacer
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                        {selectedClientsData.map(c => (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-1 pl-2 pr-1 py-1 text-xs rounded-full bg-[color:var(--bg-surface)] border border-[color:var(--border)]"
                          >
                            <span className="font-semibold truncate max-w-[10rem]">
                              {c.full_name}
                            </span>
                            {c.city && (
                              <span className="opacity-60 truncate max-w-[6rem]">
                                · {c.city}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => removeClient(c.id)}
                              className="ml-0.5 w-4 h-4 rounded-full hover:bg-red-500/20 flex items-center justify-center text-red-500"
                              title="Retirer ce client"
                              aria-label={`Retirer ${c.full_name}`}
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ============== Liste déroulante multi-sélection ============== */}
                  <div className="relative" ref={clientsDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setClientsDropdownOpen(o => !o)}
                      disabled={!clientsLoaded}
                      className="w-full form-input py-2 text-sm flex items-center justify-between gap-2 text-left disabled:opacity-60"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Users size={14} className="text-primary-light flex-shrink-0" />
                        <span className="truncate">
                          {clientsDropdownOpen
                            ? 'Fermer la liste des clients'
                            : `Ouvrir la liste (${filteredClients.length} client${
                                filteredClients.length > 1 ? 's' : ''
                              } disponible${filteredClients.length > 1 ? 's' : ''})`}
                        </span>
                      </span>
                      <ChevronDown
                        size={16}
                        className={`flex-shrink-0 transition-transform ${
                          clientsDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {clientsDropdownOpen && (
                      <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto border border-[color:var(--border)] rounded-xl bg-[color:var(--bg-surface)] shadow-xl">
                        {!clientsLoaded && (
                          <div
                            className="p-4 text-center text-xs"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Chargement des clients...
                          </div>
                        )}

                        {clientsLoaded && clients.length === 0 && (
                          <div
                            className="p-4 text-center text-xs"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Aucun client n&apos;a encore été inscrit.
                          </div>
                        )}

                        {clientsLoaded &&
                          clients.length > 0 &&
                          filteredClients.length === 0 && (
                            <div
                              className="p-4 text-center text-xs"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              Aucun client ne correspond à ces filtres.
                            </div>
                          )}

                        {filteredClients.length > 0 && (
                          <>
                            <div className="sticky top-0 bg-[color:var(--bg-card)] border-b border-[color:var(--border)] px-3 py-2 flex items-center justify-between gap-2">
                              <span
                                className="text-xs"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {filteredClients.length} dans cette liste
                              </span>
                              <div className="flex items-center gap-2 text-xs">
                                <button
                                  type="button"
                                  onClick={selectAllFiltered}
                                  className="text-primary-light hover:underline font-semibold"
                                >
                                  Tout cocher
                                </button>
                                <span style={{ color: 'var(--text-muted)' }}>·</span>
                                <button
                                  type="button"
                                  onClick={clearClients}
                                  className="text-red-500 hover:underline"
                                >
                                  Tout décocher
                                </button>
                              </div>
                            </div>

                            <div className="divide-y divide-[color:var(--border)]">
                              {filteredClients.map(c => {
                                const checked = selectedUserIds.includes(c.id);
                                return (
                                  <label
                                    key={c.id}
                                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                                      checked
                                        ? 'bg-[color:var(--primary)]/10'
                                        : 'hover:bg-[color:var(--bg-card)]'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleClient(c.id)}
                                      className="flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-sm truncate">
                                        {c.full_name}
                                      </div>
                                      <div
                                        className="text-xs truncate"
                                        style={{ color: 'var(--text-muted)' }}
                                      >
                                        {c.email}
                                        {c.city ? ` · ${c.city}` : ''}
                                      </div>
                                    </div>
                                    {checked && (
                                      <Check
                                        size={14}
                                        className="text-primary-light flex-shrink-0"
                                      />
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ============== Astuce UX ============== */}
                  <p
                    className="text-[11px] flex items-start gap-1.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    💡 Filtrez par ville pour cibler rapidement une zone géographique,
                    puis ouvrez la liste déroulante pour cocher les clients un par un
                    (ou utilisez « Tout cocher » sur la sélection filtrée).
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
        )}

        {/* ===================== PROMOTION SPÉCIALE ===================== */}
        {isPromotion && (
        <section className="border border-[color:var(--border)] rounded-2xl overflow-hidden">
          <div className="w-full flex items-center justify-between p-4 bg-[color:var(--bg-surface)]">
            <span className="flex items-center gap-2 font-display font-bold text-base">
              <Tag size={18} className="text-warning" /> Promotion spéciale
              <span className="text-xs font-normal px-2 py-0.5 rounded-full border border-[color:var(--border)] bg-warning-soft text-warning">
                ✅ Activée
              </span>
            </span>
          </div>

          <div className="p-4 sm:p-6 space-y-4 bg-[color:var(--bg)]">
              <p className="text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-warning inline-block" />
                Cette annonce sera publiée comme{' '}
                <strong className="text-warning">promotion commerciale</strong>
                {' '}— elle apparaîtra dans le carrousel défilant de la landing page.
              </p>

              <>
                  {/* Prix & réduction */}
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="form-label">Prix promotionnel (MAD) *</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        className="form-input"
                        value={price}
                        onChange={e => setPrice(e.target.value)}
                        placeholder="Ex: 1499"
                      />
                    </div>
                    <div>
                      <label className="form-label">Prix original (MAD)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        className="form-input"
                        value={originalPrice}
                        onChange={e => setOriginalPrice(e.target.value)}
                        placeholder="Auto = somme des produits"
                      />
                    </div>
                    <div>
                      <label className="form-label">
                        <CalendarClock size={14} className="inline mr-1" />
                        Date limite (optionnelle)
                      </label>
                      <input
                        type="date"
                        className="form-input"
                        value={validUntil}
                        onChange={e => setValidUntil(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Récap prix */}
                  <div className="grid sm:grid-cols-3 gap-3 text-sm">
                    <div className="p-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-card)]">
                      <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Total catalogue sélectionné
                      </div>
                      <div className="font-display font-extrabold text-lg mt-1">
                        {formatCurrency(selectedProductsTotal)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-card)]">
                      <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Prix promotion
                      </div>
                      <div className={`font-display font-extrabold text-lg mt-1 ${
                        promoPriceNum && promoPriceNum > 0 ? 'text-warning' : 'opacity-40'
                      }`}>
                        {promoPriceNum && promoPriceNum > 0 ? formatCurrency(promoPriceNum) : '—'}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-card)]">
                      <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Réduction
                      </div>
                      <div className="font-display font-extrabold text-lg mt-1 text-success">
                        {discountPct !== null ? `-${discountPct}%` : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Sélecteur de produits */}
                  <div className="border border-[color:var(--border)] rounded-xl p-4 bg-[color:var(--bg-card)] space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-bold text-sm flex items-center gap-2">
                        <Package size={16} className="text-primary-light" />
                        Produits inclus dans la promotion
                        <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-[color:var(--bg-surface)] border border-[color:var(--border)]">
                          {productSelections.length} sélectionné{productSelections.length > 1 ? 's' : ''}
                        </span>
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Cochez un ou plusieurs produits du catalogue à mettre en avant.
                      </span>
                    </div>

                    {/* Produits déjà choisis */}
                    {productSelections.length > 0 && (
                      <ul className="space-y-2">
                        {productSelections.map(sel => {
                          const p = productsById.get(sel.productId);
                          if (!p) return null;
                          return (
                            <li
                              key={sel.productId}
                              className="flex items-center gap-3 p-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-surface)]"
                            >
                              {p.image_url && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={p.image_url}
                                  alt={p.name}
                                  className="w-12 h-12 rounded object-cover border border-[color:var(--border)]"
                                />
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
                                onClick={() => removeProduct(sel.productId)}
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

                    {/* Recherche + ajout */}
                    <div className="flex gap-2 flex-wrap">
                      <div className="relative flex-1 min-w-[12rem]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                        <input
                          type="text"
                          className="form-input pl-9 py-2 text-sm"
                          placeholder="Rechercher un produit à inclure..."
                          value={productSearch}
                          onChange={e => setProductSearch(e.target.value)}
                        />
                      </div>
                    </div>

                    {!productsLoaded && (
                      <div className="text-center text-xs py-4" style={{ color: 'var(--text-muted)' }}>
                        Chargement du catalogue...
                      </div>
                    )}
                    {productsLoaded && products.length === 0 && (
                      <div className="text-center text-xs py-4" style={{ color: 'var(--text-muted)' }}>
                        Catalogue vide. Ajoutez d&apos;abord des produits depuis l&apos;administration.
                      </div>
                    )}

                    <div className="max-h-56 overflow-y-auto grid sm:grid-cols-2 gap-2 pr-1">
                      {filteredProducts.map(p => {
                        const already = productSelections.some(s => s.productId === p.id);
                        return (
                          <button
                            type="button"
                            key={p.id}
                            disabled={already}
                            onClick={() => addProductSelection(p.id)}
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
                        <div className="col-span-full text-center text-xs py-4" style={{ color: 'var(--text-muted)' }}>
                          Aucun produit ne correspond à votre recherche.
                        </div>
                      )}
                    </div>
                  </div>
              </>
            </div>
        </section>
        )}

        {/* ===================== BOUTON PUBLIER ===================== */}
        <div className="border-t border-[color:var(--border)] pt-4">
          <button
            type="submit"
            disabled={!canPublish}
            className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editingItem ? <Save size={16} /> : <Send size={16} />}
            {publishing
              ? editingItem
                ? 'Enregistrement...'
                : 'Publication...'
              : editingItem
                ? '💾 Enregistrer les modifications'
                : isPromotion
                  ? '🎉 Publier la promotion'
                  : "📰 Publier l'actualité"}
          </button>
          <p className="text-[11px] text-center mt-3" style={{ color: 'var(--text-muted)' }}>
            {editingItem
              ? '✏️ Les modifications sont enregistrées immédiatement et propagées au carrousel + boutique.'
              : isPromotion
                ? '📢 La promotion sera visible par tous les clients : carrousel de la landing page + boutique.'
                : "L'actualité sera visible uniquement dans l'espace client des destinataires choisis."}
          </p>
        </div>
      </form>
    </>
  );
}
