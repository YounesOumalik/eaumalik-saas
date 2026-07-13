'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Send, Newspaper, Upload, X, Tag, Users, Package, ChevronDown,
  ChevronUp, Search, Trash2, Plus, CalendarClock,
} from 'lucide-react';
import {
  publishNewsAction,
  getAvailableProductsForNewsAction,
  getAvailableClientsForNewsAction,
} from '@/app/actions/clientActions';
import { useToast } from '@/components/shared/ToastProvider';
import { formatCurrency } from '@/lib/utils';

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
// Composant principal
// ============================================================================
export default function CrmNews() {
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
  const [clientsLoaded, setClientsLoaded] = useState(false);

  // -- Promotion -------------------------------------------------------------
  const [isPromotion, setIsPromotion] = useState(true);
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

  const selectAllClients = () => setSelectedUserIds(clients.map(c => c.id));
  const clearClients = () => setSelectedUserIds([]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      (c.full_name ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.city ?? '').toLowerCase().includes(q)
    );
  }, [clients, clientSearch]);

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
  const canPublish =
    title.trim().length >= 3 &&
    content.trim().length >= 3 &&
    !publishing &&
    (targetAll || selectedUserIds.length >= 1);

  const targetLabel = targetAll
    ? '📢 Tous les clients'
    : selectedUserIds.length === 0
      ? '⚠️ Aucun client sélectionné'
      : `👥 ${selectedUserIds.length} client(s) ciblé(s)`;

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || publishing) return;
    if (!targetAll && selectedUserIds.length === 0) {
      toast('Sélectionnez au moins un client destinataire.', 'error');
      return;
    }

    setPublishing(true);

    const payload = {
      title: title.trim(),
      content: content.trim(),
      imageUrl: imageUrl || undefined,
      // Ciblage
      targetAll,
      targetUserIds: targetAll ? [] : selectedUserIds,
      // Promotion
      isPromotion,
      price: isPromotion ? promoPriceNum : null,
      originalPrice: isPromotion ? promoOriginalPriceNum : null,
      productIds: productSelections.map(s => s.productId),
      validUntil: validUntil ? new Date(validUntil).toISOString() : null,
    };

    const res = await publishNewsAction(payload);
    if (res.success) {
      toast(
        isPromotion
          ? '🎉 Promotion publiée ! Elle apparaît dans le carrousel de la landing.'
          : 'Actualité publiée avec succès !',
        'success'
      );
      // Reset
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
    } else {
      toast('Erreur lors de la publication : ' + res.error, 'error');
    }
    setPublishing(false);
  };

  // ============================================================================
  // Rendu
  // ============================================================================
  return (
    <>
      <h2 className="font-display font-extrabold text-2xl mb-6">
        Publier une Actualité / Promotion
      </h2>

      <form
        onSubmit={handlePublish}
        className="glass-card p-6 sm:p-8 max-w-4xl space-y-6"
        style={{ transform: 'none' }}
      >
        {/* ===================== BLOC TITRE + CONTENU ===================== */}
        <section className="space-y-4">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <Newspaper size={18} className="text-primary-light" /> Contenu de l&apos;annonce
          </h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Rédigez votre communication. Les actualités publiées apparaissent immédiatement
            dans l&apos;espace client des destinataires choisis.
          </p>
          <div>
            <label className="form-label">Titre de l&apos;annonce *</label>
            <input
              type="text"
              required
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: -20% sur les recharges de filtres ce mois-ci !"
            />
          </div>
          <div>
            <label className="form-label">Contenu de l&apos;annonce *</label>
            <textarea
              required
              rows={6}
              className="form-input min-h-[10rem]"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Écrivez le message complet ici... Décrivez l'offre, la durée, les conditions."
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
                <div className="border border-[color:var(--border)] rounded-xl p-4 bg-[color:var(--bg-card)]">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <div className="relative flex-1 min-w-[12rem]">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                      <input
                        type="text"
                        className="form-input pl-9 py-2 text-sm"
                        placeholder="Rechercher un client (nom, email, ville)..."
                        value={clientSearch}
                        onChange={e => setClientSearch(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={selectAllClients}
                      disabled={!clientsLoaded}
                      className="btn-outline py-2 px-3 text-xs rounded-lg"
                    >
                      Tout sélectionner
                    </button>
                    <button
                      type="button"
                      onClick={clearClients}
                      className="btn-outline py-2 px-3 text-xs rounded-lg"
                    >
                      Effacer
                    </button>
                  </div>

                  {!clientsLoaded && (
                    <div className="text-center text-xs py-6" style={{ color: 'var(--text-muted)' }}>
                      Chargement des clients...
                    </div>
                  )}
                  {clientsLoaded && clients.length === 0 && (
                    <div className="text-center text-xs py-6" style={{ color: 'var(--text-muted)' }}>
                      Aucun client n&apos;a encore été inscrit.
                    </div>
                  )}

                  <div className="max-h-72 overflow-y-auto grid sm:grid-cols-2 gap-2 pr-1">
                    {filteredClients.map(c => {
                      const checked = selectedUserIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${
                            checked
                              ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/10'
                              : 'border-[color:var(--border)] hover:bg-[color:var(--bg-surface)]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleClient(c.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{c.full_name}</div>
                            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                              {c.email}{c.city ? ` · ${c.city}` : ''}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                    {clientsLoaded && clients.length > 0 && filteredClients.length === 0 && (
                      <div className="col-span-full text-center text-xs py-4" style={{ color: 'var(--text-muted)' }}>
                        Aucun client ne correspond à votre recherche.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ===================== PROMOTION SPÉCIALE ===================== */}
        <section className="border border-[color:var(--border)] rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setPromoOpen(!promoOpen)}
            className="w-full flex items-center justify-between p-4 bg-[color:var(--bg-surface)] hover:bg-[color:var(--bg-card-hover)] transition-colors"
          >
            <span className="flex items-center gap-2 font-display font-bold text-base">
              <Tag size={18} className="text-warning" /> Promotion spéciale
              <span className={`text-xs font-normal px-2 py-0.5 rounded-full border border-[color:var(--border)] ${
                isPromotion ? 'bg-warning-soft text-warning' : 'bg-[color:var(--bg-card)] text-[color:var(--text-muted)]'
              }`}>
                {isPromotion ? '✅ Activée' : '— Information seulement'}
              </span>
            </span>
            {promoOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {promoOpen && (
            <div className="p-4 sm:p-6 space-y-4 bg-[color:var(--bg)]">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPromotion}
                  onChange={e => setIsPromotion(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">
                  Cochez pour transformer cette annonce en{' '}
                  <strong className="text-warning">promotion commerciale</strong>
                  {' '}— elle apparaîtra dans le carrousel défilant de la landing page.
                </span>
              </label>

              {isPromotion && (
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
              )}
            </div>
          )}
        </section>

        {/* ===================== BOUTON PUBLIER ===================== */}
        <div className="border-t border-[color:var(--border)] pt-4">
          <button
            type="submit"
            disabled={!canPublish}
            className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
            {publishing
              ? 'Publication...'
              : isPromotion
                ? '🎉 Publier la promotion'
                : "📰 Publier l'actualité"}
          </button>
          <p className="text-[11px] text-center mt-3" style={{ color: 'var(--text-muted)' }}>
            {isPromotion
              ? 'La promotion apparaîtra immédiatement dans le carrousel défilant de la landing page.'
              : "L'actualité sera visible uniquement dans l'espace client des destinataires choisis."}
          </p>
        </div>
      </form>
    </>
  );
}
