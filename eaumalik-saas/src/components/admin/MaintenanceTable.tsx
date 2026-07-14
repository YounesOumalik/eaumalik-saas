'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wrench, Eye, Plus, Filter, CalendarClock, AlertTriangle, CheckCircle2,
  Package, Truck, RefreshCw, Search,
} from 'lucide-react';
import type {
  MaintenanceRecord, MaintenanceIntervention, InterventionType, InterventionOutcome,
} from '@/types';
import { formatCurrency, formatDate, daysUntil } from '@/lib/utils';
import { useToast } from '@/components/shared/ToastProvider';
import Dialog from '@/components/ui/Dialog';
import { getCurrentUserPermissionsAction } from '@/app/actions/authActions';

const STATUS_LABELS: Record<MaintenanceRecord['status'], string> = {
  actif: 'Actif',
  a_renouveler: 'À renouveler',
  suspendu: 'Suspendu',
  resilie: 'Résilié',
};

const INTERVENTION_LABELS: Record<InterventionType, string> = {
  filter_change: 'Changement de filtre',
  inspection: 'Inspection',
  repair: 'Réparation',
  replacement: 'Remplacement',
  cleaning: 'Nettoyage',
  diagnostic: 'Diagnostic',
  other: 'Autre',
};

const OUTCOME_LABELS: Record<InterventionOutcome, string> = {
  completed: 'Terminé',
  pending: 'En attente',
  failed: 'Échec',
};

const FILTER_OPTIONS: Array<{ key: 'all' | MaintenanceRecord['status']; label: string }> = [
  { key: 'all', label: 'Tous' },
  { key: 'actif', label: 'Actifs' },
  { key: 'a_renouveler', label: 'À renouveler' },
  { key: 'suspendu', label: 'Suspendus' },
  { key: 'resilie', label: 'Résiliés' },
];

export default function MaintenanceTable({ initialRecords }: { initialRecords: MaintenanceRecord[] }) {
  const [records, setRecords] = useState<MaintenanceRecord[]>(initialRecords);
  const [filter, setFilter] = useState<'all' | MaintenanceRecord['status']>('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<MaintenanceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const router = useRouter();

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

  const canManage = !permissions || role === 'admin' || permissions.can_view_comptabilite;

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/maintenance');
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records ?? []);
      }
    } catch {
      /* silencieux */
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = records;
    if (filter !== 'all') list = list.filter(r => r.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.client_name.toLowerCase().includes(q) ||
        r.product_name.toLowerCase().includes(q) ||
        (r.client_city ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [records, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: records.length };
    records.forEach(r => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [records]);

  const stats = [
    { label: 'Total',        val: counts.total || 0,            color: 'var(--primary-light)', bg: 'rgba(8,145,178,0.1)' },
    { label: 'Actifs',       val: counts.actif || 0,            color: '#34d399',            bg: 'rgba(16,185,129,0.1)' },
    { label: 'À renouveler', val: counts.a_renouveler || 0,     color: '#fbbf24',            bg: 'rgba(245,158,11,0.1)' },
    { label: 'Interventions',val: records.reduce((s, r) => s + (r.intervention_count || 0), 0), color: '#22d3ee', bg: 'rgba(6,182,212,0.1)' },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-extrabold text-xl">Suivi de Maintenance</h2>
        <button onClick={refresh} className="btn-outline btn-sm inline-flex items-center gap-1.5" disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            <div className="text-2xl font-display font-extrabold" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex flex-wrap gap-2" role="tablist">
          {FILTER_OPTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={`btn-chip ${filter === s.key ? (s.key === 'all' ? 'active btn-chip-fill' : 'active') : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher client / produit..."
            className="pl-8 pr-3 py-1.5 text-sm rounded-lg border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text)' }}
          />
        </div>
      </div>

      <div className="glass-card overflow-x-auto" style={{ transform: 'none' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Client</th><th>Produit</th><th>Installé le</th><th>Prochaine intervention</th><th>Interv.</th><th>Statut</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const due = r.next_service_date ? daysUntil(r.next_service_date) : null;
              const isOverdue = due !== null && due < 0;
              const isSoon = due !== null && due >= 0 && due <= 30;
              return (
                <tr key={r.id}>
                  <td>
                    <div className="text-sm font-medium">{r.client_name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.client_city}</div>
                  </td>
                  <td className="text-sm">{r.product_name}</td>
                  <td className="text-sm">{formatDate(r.install_date)}</td>
                  <td>
                    {r.next_service_date ? (
                      <span className={`inline-flex items-center gap-1 text-sm ${isOverdue ? 'font-semibold' : ''}`} style={{ color: isOverdue ? '#f87171' : isSoon ? '#fbbf24' : 'var(--text)' }}>
                        {isOverdue && <AlertTriangle size={12} />}
                        {formatDate(r.next_service_date)}
                        {due !== null && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({due}j)</span>}
                      </span>
                    ) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="text-sm font-semibold">{r.intervention_count || 0}</td>
                  <td><span className={`badge badge-${r.status}`}>{STATUS_LABELS[r.status]}</span></td>
                  <td>
                    <div className="flex gap-1.5">
                      <button onClick={() => setDetail(r)} className="btn-outline btn-sm" title="Détails & historique"><Eye size={12} /></button>
                      {canManage && (
                        <button onClick={() => router.push(`/admin/maintenance?record=${r.id}`)} className="btn-primary btn-sm" title="Gérer"><Wrench size={12} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Aucun programme de maintenance pour ce filtre.</div>}
      </div>

      {detail && (
        <MaintenanceDetailModal
          record={detail}
          canManage={canManage}
          onClose={() => setDetail(null)}
          onChanged={(updated) => {
            setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
            setDetail(updated);
          }}
        />
      )}
    </>
  );
}

function MaintenanceDetailModal({
  record, canManage, onClose, onChanged,
}: {
  record: MaintenanceRecord;
  canManage: boolean;
  onClose: () => void;
  onChanged: (r: MaintenanceRecord) => void;
}) {
  const toast = useToast();
  const [notes, setNotes] = useState(record.notes ?? '');
  const [status, setStatus] = useState<MaintenanceRecord['status']>(record.status);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  // Formulaire d'intervention
  const [itType, setItType] = useState<InterventionType>('filter_change');
  const [itDesc, setItDesc] = useState('');
  const [itTech, setItTech] = useState('');
  const [itCost, setItCost] = useState('0');
  const [itParts, setItParts] = useState('');
  const [itNext, setItNext] = useState(record.next_service_date ?? '');
  const [itOutcome, setItOutcome] = useState<InterventionOutcome>('completed');

  const saveMeta = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/maintenance/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });
      if (res.ok) {
        onChanged({ ...record, status, notes });
        toast('Fiche mise à jour', 'success');
      } else {
        toast('Échec de la mise à jour', 'error');
      }
    } catch {
      toast('Erreur réseau', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addIntervention = async () => {
    if (itDesc.trim().length < 3) {
      toast('Description trop courte', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/maintenance/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intervention: {
            intervention_type: itType,
            description: itDesc,
            technician_name: itTech || undefined,
            cost: Number(itCost) || 0,
            parts_used: itParts.split(',').map(s => s.trim()).filter(Boolean),
            next_service_date: itNext || undefined,
            outcome: itOutcome,
          },
        }),
      });
      if (res.ok) {
        // Recharger la fiche complète
        const r2 = await fetch(`/api/maintenance?order_id=${record.order_id ?? ''}`);
        const data = await r2.json();
        const fresh = (data.records ?? []).find((x: MaintenanceRecord) => x.id === record.id) ?? record;
        onChanged(fresh);
        setShowAdd(false);
        setItDesc(''); setItParts(''); setItTech('');
        toast('Intervention enregistrée', 'success');
      } else {
        toast('Échec de l\'enregistrement', 'error');
      }
    } catch {
      toast('Erreur réseau', 'error');
    } finally {
      setSaving(false);
    }
  };

  const interventions = record.interventions ?? [];

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title={`Maintenance — ${record.product_name}`}
      icon={<Wrench size={18} />}
      size="2xl"
      maxHeight="tall"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canManage && (
            <button onClick={saveMeta} disabled={saving} className="btn-primary btn-sm inline-flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Enregistrer
            </button>
          )}
          <button onClick={onClose} className="btn-outline btn-sm">
            Fermer
          </button>
        </div>
      }
    >
      <div className="flex items-center justify-between mb-4 -mt-2">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{record.client_name} · {record.client_city}</span>
        <span className={`badge badge-${record.status}`}>{STATUS_LABELS[record.status]}</span>
      </div>

      {/* En-tête infos */}
      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <div className="stat-card"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Installé le</div><div className="font-semibold text-sm">{formatDate(record.install_date)}</div></div>
        <div className="stat-card"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Prochaine intervention</div><div className="font-semibold text-sm">{record.next_service_date ? formatDate(record.next_service_date) : '—'}</div></div>
        <div className="stat-card"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Coût cumulé</div><div className="font-semibold text-sm">{formatCurrency(record.total_cost || 0)}</div></div>
      </div>

      {/* Filtres / types */}
      {record.filter_types && record.filter_types.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {record.filter_types.map(f => (
            <span key={f} className="badge badge-actif">{f}</span>
          ))}
        </div>
      )}

      {/* Historique des interventions */}
      <h3 className="font-display font-semibold text-sm mb-3 flex items-center gap-2">
        <CalendarClock size={14} /> Historique des interventions ({interventions.length})
      </h3>
      <div className="space-y-2 mb-4 max-h-72 overflow-y-auto pr-1">
        {interventions.length === 0 && (
          <div className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>Aucune intervention enregistrée.</div>
        )}
        {interventions.map((it: MaintenanceIntervention) => (
          <div key={it.id} className="p-3 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm inline-flex items-center gap-1.5">
                {it.intervention_type === 'filter_change' && <RefreshCw size={13} />}
                {it.intervention_type === 'inspection' && <Eye size={13} />}
                {it.intervention_type === 'repair' && <Wrench size={13} />}
                {it.intervention_type === 'replacement' && <Package size={13} />}
                {it.intervention_type === 'cleaning' && <RefreshCw size={13} />}
                {it.intervention_type === 'diagnostic' && <Search size={13} />}
                {it.intervention_type === 'other' && <Wrench size={13} />}
                {INTERVENTION_LABELS[it.intervention_type]}
              </span>
              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{formatDate(it.performed_at)}</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text)' }}>{it.description}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              {it.technician_name && <span>👷 {it.technician_name}</span>}
              {it.cost > 0 && <span>· {formatCurrency(it.cost)}</span>}
              {it.parts_used?.length > 0 && <span>· Pièces : {it.parts_used.join(', ')}</span>}
              <span className={`badge badge-${it.outcome === 'completed' ? 'actif' : it.outcome === 'failed' ? 'a_renouveler' : 'suspendu'}`}>{OUTCOME_LABELS[it.outcome]}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Formulaire d'ajout d'intervention */}
      {canManage && (
        <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(8,145,178,0.06)', border: '1px solid rgba(8,145,178,0.18)' }}>
          {!showAdd ? (
            <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm inline-flex items-center gap-1.5">
              <Plus size={14} /> Ajouter une intervention
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-base">Nouvelle intervention</div>
                <button onClick={() => setShowAdd(false)} className="btn-outline btn-sm">Annuler</button>
              </div>

              {/* Ligne 1 : 4 champs alignes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="form-label">Type d&apos;intervention</label>
                  <select value={itType} onChange={e => setItType(e.target.value as InterventionType)} className="form-input">
                    {Object.entries(INTERVENTION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Technicien</label>
                  <input value={itTech} onChange={e => setItTech(e.target.value)} placeholder="Nom du technicien" className="form-input" />
                </div>
                <div>
                  <label className="form-label">Coût (DH)</label>
                  <input type="number" min={0} value={itCost} onChange={e => setItCost(e.target.value)} placeholder="0" className="form-input" />
                </div>
                <div>
                  <label className="form-label">Prochaine intervention</label>
                  <input type="date" value={itNext} onChange={e => setItNext(e.target.value)} className="form-input" />
                </div>
              </div>

              {/* Ligne 2 : Description sur toute la largeur, plus grande */}
              <div>
                <label className="form-label">Description de l&apos;intervention</label>
                <textarea
                  value={itDesc}
                  onChange={e => setItDesc(e.target.value)}
                  placeholder="Décrivez en détail l'intervention réalisée (problème constaté, actions menées, recommandations...)"
                  rows={5}
                  className="form-input resize-y min-h-[140px]"
                />
              </div>

              {/* Ligne 3 : Pièces changées sur toute la largeur */}
              <div>
                <label className="form-label">Pièces changées</label>
                <input
                  value={itParts}
                  onChange={e => setItParts(e.target.value)}
                  placeholder="Filtre charbon 10 pouces, Joint torique, Membrane (séparées par virgule)"
                  className="form-input"
                />
              </div>

              {/* Ligne 4 : Résultat + Enregistrer */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Résultat :</span>
                  {(['completed', 'pending', 'failed'] as InterventionOutcome[]).map(o => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setItOutcome(o)}
                      className={itOutcome === o ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
                    >
                      {OUTCOME_LABELS[o]}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addIntervention}
                  disabled={saving}
                  className="btn-success inline-flex items-center gap-1.5 px-5 py-2.5 sm:ml-auto"
                >
                  <CheckCircle2 size={14} /> Enregistrer l&apos;intervention
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      </Dialog>
  );
}
