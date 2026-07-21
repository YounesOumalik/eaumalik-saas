'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, Warehouse, Store, PackageOpen, MapPin,
  Archive, RotateCcw, AlertTriangle, ArrowRightLeft, CheckCircle2, XCircle, Clock,
  Send, RefreshCw, HelpCircle, BookOpen,
} from 'lucide-react';
import { useToast } from '@/components/shared/ToastProvider';
import Dialog from '@/components/ui/Dialog';
import {
  createLocationAction,
  updateLocationAction,
  archiveLocationAction,
  restoreLocationAction,
  purgeLocationAction,
} from '@/app/actions/locationsActions';
import {
  createTransferRequestAction,
  updateTransferRequestAction,
  executeTransferRequestAction,
  listTransferRequestsAction,
} from '@/app/actions/transferActions';
import { useSupabaseAuth } from '@/components/shared/SupabaseAuthProvider';
import type {
  Location, LocationType, ProductLocationStockEntry, TransferRequestRow,
} from '@/types';

const LOCATION_ICONS: Record<LocationType, any> = {
  depot: Warehouse,
  magasin: Store,
  presentoir: PackageOpen,
};
const LOCATION_TYPE_LABELS_SHORT: Record<LocationType, string> = {
  depot: 'Dépôt', magasin: 'Magasin', presentoir: 'Présentoir',
};

interface Props {
  initialLocations: Location[];
  initialStock: ProductLocationStockEntry[];
  initialTransfers: TransferRequestRow[];
}

type Tab = 'locations' | 'inventory' | 'workflows';

export default function LocationsManager({ initialLocations, initialStock, initialTransfers }: Props) {
  const toast = useToast();
  const { role: currentUserRole } = useSupabaseAuth();
  const isSuperAdmin = currentUserRole === 'admin';
  const isAdmin = currentUserRole === 'administrator' || isSuperAdmin;

  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [stock, setStock] = useState<ProductLocationStockEntry[]>(initialStock);
  const [transfers, setTransfers] = useState<TransferRequestRow[]>(initialTransfers);
  const [tab, setTab] = useState<Tab>('locations');

  // Filtres Localités
  const [filterType, setFilterType] = useState<LocationType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'active' | 'archived' | 'all'>('active');

  // Dialog état
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Bandeau d'aide collapsible
  const [showHelp, setShowHelp] = useState(true);

  // Inventaire
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    initialLocations.find((l) => !l.is_archived)?.id ?? null,
  );

  // Workflows
  const [transferFilter, setTransferFilter] = useState<TransferRequestRow['status'] | 'all'>('all');

  const visibleLocations = useMemo(
    () => locations
      .filter((l) => (filterType === 'all' ? true : l.type === filterType))
      .filter((l) => (filterStatus === 'all' ? true : filterStatus === 'archived' ? l.is_archived : !l.is_archived && l.is_active)),
    [locations, filterType, filterStatus],
  );

  const refreshLocations = async () => {
    // On demande au composant de re-render ; ici on fait un soft refresh via
    // location.reload côté serveur (le Server Component recharge tout).
    // Pour rester client-only, on fetch via une action dédiée n'est pas
    // dispo — fallback sur window.location.reload après un toast.
    toast('Rechargement de la page…', 'success');
    setTimeout(() => window.location.reload(), 400);
  };

  const refreshTransfers = async () => {
    const res = await listTransferRequestsAction({});
    if (res.success) setTransfers(res.requests);
    else toast('Erreur chargement demandes : ' + res.error, 'error');
  };

  useEffect(() => {
    refreshTransfers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================================
  // CRUD Localités
  // ============================================================================

  const handleOpenCreate = () => {
    setEditingLocation(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (loc: Location) => {
    setEditingLocation(loc);
    setModalOpen(true);
  };

  const handleArchive = async (loc: Location) => {
    if (!confirm(`Archiver la localité « ${loc.name} » ?`)) return;
    const res = await archiveLocationAction(loc.id);
    if (res.success) {
      setLocations((prev) => prev.map((l) => (l.id === loc.id ? res.location : l)));
      toast('Localité archivée.', 'success');
    } else toast('Erreur : ' + res.error, 'error');
  };

  const handleRestore = async (loc: Location) => {
    const res = await restoreLocationAction(loc.id);
    if (res.success) {
      setLocations((prev) => prev.map((l) => (l.id === loc.id ? res.location : l)));
      toast('Localité restaurée.', 'success');
    } else toast('Erreur : ' + res.error, 'error');
  };

  const handlePurge = async (loc: Location) => {
    if (!confirm(`Supprimer DÉFINITIVEMENT « ${loc.name} » ? Action irréversible.`)) return;
    const res = await purgeLocationAction(loc.id);
    if (res.success) {
      setLocations((prev) => prev.filter((l) => l.id !== loc.id));
      toast('Localité supprimée définitivement.', 'success');
    } else toast('Erreur : ' + res.error, 'error');
  };

  const handleSubmitLocation = async (formData: any) => {
    setSubmitting(true);
    const payload = {
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      type: formData.type,
      address: formData.address.trim() || null,
      city: formData.city.trim() || null,
      phone: formData.phone.trim() || null,
      capacity_units: Number(formData.capacity_units) || 0,
      capacity_area_m2: Number(formData.capacity_area_m2) || 0,
      is_active: formData.is_active,
      notes: formData.notes.trim() || null,
    };
    const res = editingLocation
      ? await updateLocationAction(editingLocation.id, payload)
      : await createLocationAction(payload);
    if (res.success) {
      setLocations((prev) => {
        if (editingLocation) return prev.map((l) => (l.id === res.location.id ? res.location : l));
        return [res.location, ...prev];
      });
      toast(editingLocation ? 'Localité mise à jour.' : 'Localité créée.', 'success');
      setModalOpen(false);
    } else {
      toast('Erreur : ' + res.error, 'error');
    }
    setSubmitting(false);
  };

  // ============================================================================
  // Inventaire + Transferts (UI légère)
  // ============================================================================

  const stockForSelected = useMemo(
    () => (selectedLocationId ? stock.filter((s) => s.location_id === selectedLocationId) : []),
    [stock, selectedLocationId],
  );

  const totalUnitsForSelected = useMemo(
    () => stockForSelected.reduce((acc, s) => acc + s.quantity, 0),
    [stockForSelected],
  );

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedLocationId) ?? null,
    [locations, selectedLocationId],
  );

  const [transferModal, setTransferModal] = useState<{
    productId: string; productName: string; sourceId: string; destId: string; quantity: number; reason: string;
  } | null>(null);
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const handleTransferSubmit = async () => {
    if (!transferModal) return;
    setTransferSubmitting(true);
    const res = await createTransferRequestAction({
      product_id: transferModal.productId,
      source_location_id: transferModal.sourceId,
      destination_location_id: transferModal.destId,
      quantity: transferModal.quantity,
      reason: transferModal.reason,
    });
    if (res.success) {
      toast('Demande de transfert créée (en attente d\'approbation).', 'success');
      setTransferModal(null);
      refreshTransfers();
    } else toast('Erreur : ' + res.error, 'error');
    setTransferSubmitting(false);
  };

  // ============================================================================
  // Workflow — approve/reject/execute/cancel
  // ============================================================================

  const handleApprove = async (tr: TransferRequestRow) => {
    const res = await updateTransferRequestAction({ request_id: tr.id, action: 'approve' });
    if (res.success) { toast('Demande approuvée.', 'success'); refreshTransfers(); }
    else toast('Erreur : ' + res.error, 'error');
  };
  const handleReject = async (tr: TransferRequestRow) => {
    const comment = window.prompt('Commentaire de rejet (obligatoire) :');
    if (!comment) return;
    const res = await updateTransferRequestAction({ request_id: tr.id, action: 'reject', comment });
    if (res.success) { toast('Demande rejetée.', 'success'); refreshTransfers(); }
    else toast('Erreur : ' + res.error, 'error');
  };
  const handleExecute = async (tr: TransferRequestRow) => {
    const res = await executeTransferRequestAction(tr.id);
    if (res.success) { toast('Transfert exécuté.', 'success'); refreshTransfers(); refreshLocations(); }
    else toast('Erreur : ' + res.error, 'error');
  };
  const handleCancel = async (tr: TransferRequestRow) => {
    if (!confirm('Annuler cette demande ?')) return;
    const res = await updateTransferRequestAction({ request_id: tr.id, action: 'cancel' });
    if (res.success) { toast('Demande annulée.', 'success'); refreshTransfers(); }
    else toast('Erreur : ' + res.error, 'error');
  };

  const filteredTransfers = useMemo(
    () => (transferFilter === 'all' ? transfers : transfers.filter((t) => t.status === transferFilter)),
    [transfers, transferFilter],
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-display font-extrabold text-xl flex items-center gap-2">
          <MapPin size={20} /> Module Logistique
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs"
            title="Afficher l'aide du module"
            style={{ background: 'var(--bg-card-hover)', color: 'var(--text-muted)' }}
            aria-label="Aide"
          >
            <HelpCircle size={13} />
          </button>
        </h2>
        <div className="flex gap-2">
          <a
            href="/docs/MODULE-LOGISTIQUE.md"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline btn-sm flex items-center gap-1.5"
            title="Documentation utilisateur complète"
          >
            <BookOpen size={12} /> Doc
          </a>
          <button onClick={refreshLocations} className="btn-outline btn-sm flex items-center gap-1.5">
            <RefreshCw size={12} /> Rafraîchir
          </button>
        </div>
      </div>

      {showHelp && (
        <div className="glass-card p-4 mb-4 text-sm" style={{ borderColor: 'var(--primary)' }}>
          <div className="flex items-start gap-3">
            <BookOpen size={18} className="text-primary-light shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold mb-2">Aide rapide</div>
              <ul className="space-y-1 text-xs opacity-90">
                <li>
                  <strong>Localités</strong> : déclarez vos dépôts, magasins et présentoirs physiques. Renseignez
                  les capacités (unités / m²) pour activer les alertes visuelles.
                </li>
                <li>
                  <strong>Inventaire</strong> : sélectionnez une localité pour voir les produits qui s&apos;y trouvent
                  et leur quantité. Le bouton « Transférer » crée une demande (workflow 2 niveaux).
                </li>
                <li>
                  <strong>Workflows</strong> : file d&apos;attente des transferts. <code className="text-[10px] px-1 rounded" style={{ background: 'var(--bg-card-hover)' }}>admin</code> et <code className="text-[10px] px-1 rounded" style={{ background: 'var(--bg-card-hover)' }}>administrator</code> peuvent
                  approuver / rejeter / exécuter. Le demandeur peut annuler.
                </li>
                <li>
                  <strong>Affectations</strong> : dans <code className="text-[10px] px-1 rounded" style={{ background: 'var(--bg-card-hover)' }}>/admin/personnels</code>, créez un profil <code className="text-[10px] px-1 rounded" style={{ background: 'var(--bg-card-hover)' }}>store_manager</code>, <code className="text-[10px] px-1 rounded" style={{ background: 'var(--bg-card-hover)' }}>depot_manager</code> ou <code className="text-[10px] px-1 rounded" style={{ background: 'var(--bg-card-hover)' }}>presentoir_manager</code> puis choisissez les localités auxquelles il a accès.
                </li>
              </ul>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="mt-2 text-[11px] underline opacity-80 hover:opacity-100"
              >
                Masquer l&apos;aide
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {(['locations', 'inventory', 'workflows'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="px-4 py-2 text-sm font-semibold transition-all"
              style={{
                background: tab === t ? 'var(--primary)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {t === 'locations' ? 'Localités' : t === 'inventory' ? 'Inventaire' : 'Workflows'}
              {t === 'workflows' && transfers.filter((tr) => tr.status === 'pending').length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  {transfers.filter((tr) => tr.status === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* =========================== ONGLET LOCALITÉS =========================== */}
      {tab === 'locations' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="form-input text-sm w-auto">
              <option value="all">Tous types</option>
              <option value="depot">Dépôts</option>
              <option value="magasin">Magasins</option>
              <option value="presentoir">Présentoirs</option>
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="form-input text-sm w-auto">
              <option value="active">Actives</option>
              <option value="archived">Archivées</option>
              <option value="all">Toutes</option>
            </select>
            <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-1.5 ml-auto">
              <Plus size={14} /> Nouvelle localité
            </button>
          </div>

          {visibleLocations.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              Aucune localité. Cliquez sur « Nouvelle localité » pour commencer.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleLocations.map((loc) => {
                const Icon = LOCATION_ICONS[loc.type];
                const usage = stock.filter((s) => s.location_id === loc.id).reduce((acc, s) => acc + s.quantity, 0);
                const capPct = loc.capacity_units > 0 ? Math.min(100, Math.round((usage / loc.capacity_units) * 100)) : 0;
                const overCapacity = loc.capacity_units > 0 && usage > loc.capacity_units;
                return (
                  <div key={loc.id} className="glass-card p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon size={20} className="text-cyan-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-mono text-[10px] opacity-70">{loc.code}</div>
                          <div className="font-semibold text-sm truncate">{loc.name}</div>
                          <div className="text-xs opacity-70">{LOCATION_TYPE_LABELS_SHORT[loc.type]}{loc.city ? ` — ${loc.city}` : ''}</div>
                        </div>
                      </div>
                      {loc.is_archived && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-500/20 text-slate-300">Archivé</span>
                      )}
                    </div>

                    {loc.capacity_units > 0 && (
                      <div>
                        <div className="flex justify-between text-[10px] mb-1 opacity-80">
                          <span>{usage} / {loc.capacity_units} unités</span>
                          <span>{capPct}%</span>
                        </div>
                        <div className="capacity-bar">
                          <div
                            className="capacity-fill"
                            style={{
                              width: `${capPct}%`,
                              background: overCapacity ? '#ef4444' : capPct >= 90 ? '#f97316' : '#22c55e',
                            }}
                          />
                        </div>
                        {overCapacity && (
                          <div className="text-[10px] mt-1 text-amber-400 flex items-center gap-1">
                            <AlertTriangle size={10} /> Sur-capacité
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-1.5 mt-auto">
                      <button onClick={() => handleOpenEdit(loc)} className="btn-outline btn-sm flex-1 flex items-center justify-center gap-1">
                        <Edit2 size={11} /> Modifier
                      </button>
                      {loc.is_archived ? (
                        <>
                          <button onClick={() => handleRestore(loc)} className="btn-outline btn-sm" title="Restaurer">
                            <RotateCcw size={11} />
                          </button>
                          {isSuperAdmin && (
                            <button onClick={() => handlePurge(loc)} className="btn-outline btn-sm text-danger border-danger" title="Supprimer définitivement">
                              <Trash2 size={11} />
                            </button>
                          )}
                        </>
                      ) : (
                        <button onClick={() => handleArchive(loc)} className="btn-outline btn-sm" title="Archiver">
                          <Archive size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================== ONGLET INVENTAIRE =========================== */}
      {tab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold">Localité :</label>
            <select
              value={selectedLocationId ?? ''}
              onChange={(e) => setSelectedLocationId(e.target.value || null)}
              className="form-input text-sm w-auto min-w-[260px]"
            >
              <option value="">— Sélectionner —</option>
              {locations.filter((l) => !l.is_archived).map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code} — {loc.name}
                </option>
              ))}
            </select>
          </div>

          {selectedLocation && (
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="stat-card">
                <div className="stat-card__label">Unités en stock</div>
                <div className="stat-card__value">{totalUnitsForSelected}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__label">Capacité déclarée</div>
                <div className="stat-card__value">
                  {selectedLocation.capacity_units > 0 ? selectedLocation.capacity_units : '—'}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card__label">Remplissage</div>
                <div className="stat-card__value">
                  {selectedLocation.capacity_units > 0
                    ? `${Math.min(100, Math.round((totalUnitsForSelected / selectedLocation.capacity_units) * 100))}%`
                    : '—'}
                </div>
              </div>
            </div>
          )}

          {selectedLocation && (
            <div className="glass-card overflow-x-auto" style={{ transform: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Quantité ici</th>
                    <th>Stock global</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stockForSelected.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center text-sm py-6" style={{ color: 'var(--text-muted)' }}>
                        Aucun produit dans cette localité.
                      </td>
                    </tr>
                  ) : (
                    stockForSelected.map((s) => (
                      <tr key={`${s.product_id}-${s.location_id}`}>
                        <td className="text-sm">{s.product?.name ?? s.product_id}</td>
                        <td><span className="font-bold">{s.quantity}</span></td>
                        <td className="text-xs opacity-70">{s.product?.stock ?? '—'}</td>
                        <td>
                          <button
                            onClick={() => setTransferModal({
                              productId: s.product_id,
                              productName: s.product?.name ?? s.product_id,
                              sourceId: selectedLocation.id,
                              destId: '',
                              quantity: 1,
                              reason: '',
                            })}
                            className="btn-outline btn-sm flex items-center gap-1"
                            disabled={s.quantity <= 0}
                          >
                            <ArrowRightLeft size={11} /> Transférer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================== ONGLET WORKFLOWS =========================== */}
      {tab === 'workflows' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select value={transferFilter} onChange={(e) => setTransferFilter(e.target.value as any)} className="form-input text-sm w-auto">
              <option value="all">Tous statuts</option>
              <option value="pending">En attente</option>
              <option value="approved">Approuvées</option>
              <option value="executed">Exécutées</option>
              <option value="rejected">Rejetées</option>
              <option value="cancelled">Annulées</option>
            </select>
          </div>

          <div className="glass-card overflow-x-auto" style={{ transform: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Trajet</th>
                  <th>Qté</th>
                  <th>Demandeur</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-sm py-6" style={{ color: 'var(--text-muted)' }}>
                      Aucune demande de transfert.
                    </td>
                  </tr>
                ) : (
                  filteredTransfers.map((tr) => {
                    const canApprove = isAdmin && tr.status === 'pending';
                    const canReject = isAdmin && tr.status === 'pending';
                    const canExecute = (isAdmin || true) && tr.status === 'approved';
                    const canCancel = (tr.requester_id === 'mock-admin' || isAdmin) && (tr.status === 'pending' || tr.status === 'approved');
                    return (
                      <tr key={tr.id}>
                        <td className="text-sm">{tr.product_name ?? tr.product_id}</td>
                        <td className="text-xs">
                          <div className="font-mono opacity-70">{tr.source_code}</div>
                          <div>→ {tr.destination_code}</div>
                        </td>
                        <td className="font-bold">{tr.quantity}</td>
                        <td className="text-xs">
                          <div>{tr.requester_name ?? tr.requester_id}</div>
                          <div className="opacity-60">{tr.requester_role}</div>
                        </td>
                        <td>
                          <TransferStatusBadge status={tr.status} />
                        </td>
                        <td>
                          <div className="flex gap-1.5">
                            {canApprove && (
                              <button onClick={() => handleApprove(tr)} className="btn-outline btn-sm text-success border-success flex items-center gap-1" title="Approuver">
                                <CheckCircle2 size={11} />
                              </button>
                            )}
                            {canReject && (
                              <button onClick={() => handleReject(tr)} className="btn-outline btn-sm text-danger border-danger flex items-center gap-1" title="Rejeter">
                                <XCircle size={11} />
                              </button>
                            )}
                            {canExecute && (
                              <button onClick={() => handleExecute(tr)} className="btn-primary btn-sm flex items-center gap-1" title="Exécuter maintenant">
                                <Send size={11} /> Exécuter
                              </button>
                            )}
                            {canCancel && (
                              <button onClick={() => handleCancel(tr)} className="btn-outline btn-sm" title="Annuler">
                                <XCircle size={11} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================== DIALOGS =========================== */}

      {/* Création/édition localité */}
      <LocationFormDialog
        open={modalOpen}
        editing={editingLocation}
        submitting={submitting}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmitLocation}
      />

      {/* Transfert */}
      <Dialog
        open={!!transferModal}
        onClose={() => !transferSubmitting && setTransferModal(null)}
        title="Demande de transfert"
        icon={<ArrowRightLeft size={18} />}
        size="md"
        footer={
          <>
            <button onClick={() => setTransferModal(null)} disabled={transferSubmitting} className="btn-outline flex-1 py-2.5">Annuler</button>
            <button onClick={handleTransferSubmit} disabled={transferSubmitting || !transferModal?.destId || (transferModal?.quantity ?? 0) <= 0} className="btn-primary flex-1 py-2.5">
              {transferSubmitting ? 'Envoi…' : 'Créer la demande'}
            </button>
          </>
        }
      >
        {transferModal && (
          <div className="space-y-4 text-sm">
            <div>
              <label className="form-label">Produit</label>
              <input className="form-input" value={transferModal.productName} disabled />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Source</label>
                <input
                  className="form-input"
                  value={locations.find((l) => l.id === transferModal.sourceId)?.code ?? ''}
                  disabled
                />
              </div>
              <div>
                <label className="form-label">Destination</label>
                <select
                  className="form-input"
                  value={transferModal.destId}
                  onChange={(e) => setTransferModal({ ...transferModal, destId: e.target.value })}
                >
                  <option value="">— Choisir —</option>
                  {locations
                    .filter((l) => l.id !== transferModal.sourceId && !l.is_archived && l.is_active)
                    .map((l) => (
                      <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
                    ))}
                </select>
              </div>
            </div>
            <div>
              <label className="form-label">Quantité</label>
              <input
                type="number"
                min={1}
                className="form-input"
                value={transferModal.quantity}
                onChange={(e) => setTransferModal({ ...transferModal, quantity: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="form-label">Motif (optionnel)</label>
              <textarea
                className="form-input"
                rows={2}
                value={transferModal.reason}
                onChange={(e) => setTransferModal({ ...transferModal, reason: e.target.value })}
              />
            </div>
            <div className="text-xs rounded p-2" style={{ background: 'var(--bg-card-hover)', color: 'var(--text-muted)' }}>
              La demande passera en statut <strong>pending</strong>. Un admin/administrateur devra l&apos;approuver avant exécution.
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

// ============================================================================
// Sous-composant : Dialog de formulaire localité
// ============================================================================

function LocationFormDialog({
  open, editing, submitting, onClose, onSubmit,
}: {
  open: boolean;
  editing: Location | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<LocationType>('depot');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [capacityUnits, setCapacityUnits] = useState(0);
  const [capacityArea, setCapacityArea] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editing) {
      setCode(editing.code);
      setName(editing.name);
      setType(editing.type);
      setAddress(editing.address ?? '');
      setCity(editing.city ?? '');
      setPhone(editing.phone ?? '');
      setCapacityUnits(editing.capacity_units);
      setCapacityArea(editing.capacity_area_m2);
      setIsActive(editing.is_active);
      setNotes(editing.notes ?? '');
    } else {
      setCode(''); setName(''); setType('depot'); setAddress(''); setCity(''); setPhone('');
      setCapacityUnits(0); setCapacityArea(0); setIsActive(true); setNotes('');
    }
  }, [editing, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ code, name, type, address, city, phone, capacity_units: capacityUnits, capacity_area_m2: capacityArea, is_active: isActive, notes });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Modifier la localité' : 'Nouvelle localité'}
      icon={<MapPin size={18} />}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={submitting} className="btn-outline flex-1 py-2.5">Annuler</button>
          <button type="submit" form="location-form" disabled={submitting} className="btn-primary flex-1 py-2.5">
            {submitting ? 'Envoi…' : editing ? 'Enregistrer' : 'Créer'}
          </button>
        </>
      }
    >
      <form id="location-form" onSubmit={handleSubmit} className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Code *</label>
            <input className="form-input" required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="D-CASA-01" />
          </div>
          <div>
            <label className="form-label">Type *</label>
            <select className="form-input" value={type} onChange={(e) => setType(e.target.value as LocationType)}>
              <option value="depot">Dépôt</option>
              <option value="magasin">Magasin</option>
              <option value="presentoir">Présentoir</option>
            </select>
          </div>
        </div>
        <div>
          <label className="form-label">Nom *</label>
          <input className="form-input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Adresse</label>
            <input className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Ville</label>
            <input className="form-input" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="form-label">Téléphone</label>
            <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Capacité (unités)</label>
            <input type="number" min={0} className="form-input" value={capacityUnits} onChange={(e) => setCapacityUnits(Number(e.target.value))} />
          </div>
          <div>
            <label className="form-label">Capacité (m²)</label>
            <input type="number" min={0} step="0.5" className="form-input" value={capacityArea} onChange={(e) => setCapacityArea(Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>Localité active</span>
          </label>
        </div>
        <div>
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </form>
    </Dialog>
  );
}

// ============================================================================
// Badge statut transfert
// ============================================================================

function TransferStatusBadge({ status }: { status: TransferRequestRow['status'] }) {
  const map: Record<TransferRequestRow['status'], { label: string; cls: string; icon: any }> = {
    pending:   { label: 'En attente',  cls: 'bg-amber-500/15 text-amber-400',     icon: Clock },
    approved:  { label: 'Approuvée',   cls: 'bg-cyan-500/15 text-cyan-400',       icon: CheckCircle2 },
    rejected:  { label: 'Rejetée',     cls: 'bg-rose-500/15 text-rose-400',       icon: XCircle },
    executed:  { label: 'Exécutée',    cls: 'bg-emerald-500/15 text-emerald-400', icon: CheckCircle2 },
    cancelled: { label: 'Annulée',     cls: 'bg-slate-500/15 text-slate-300',     icon: XCircle },
  };
  const cfg = map[status];
  const Icon = cfg.icon;
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase inline-flex items-center gap-1 ${cfg.cls}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}