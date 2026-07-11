'use client';

import { useState, useMemo } from 'react';
import { Eye, X } from 'lucide-react';
import type { User, Order, OrderStatus, MaintenanceAlert } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

const STATUS_LABELS: Record<OrderStatus, string> = {
  en_attente: 'En attente',
  traitee: 'Traitée',
  en_livraison: 'En livraison',
  livree: 'Livreee',
  annulee: 'Annulée',
};

export default function ClientList({
  initialClients,
  allOrders,
  allMaintenance,
}: {
  initialClients: User[];
  allOrders: Order[];
  allMaintenance: MaintenanceAlert[];
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<User | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'buyers' | 'prospects'>('all');

  const stats = useMemo(() => {
    return initialClients.map(c => {
      const orders = allOrders.filter(o => o.user_id === c.id || (c.phone && o.client_phone === c.phone));
      return {
        ...c,
        orders_count: orders.length,
        total_spent: orders.reduce((s, o) => s + o.total, 0),
        last_order: orders[0]?.created_at ?? c.created_at,
      };
    });
  }, [initialClients, allOrders]);

  const filtered = useMemo(() => {
    let list = stats;
    if (filterType === 'buyers') {
      list = list.filter(c => c.orders_count > 0);
    } else if (filterType === 'prospects') {
      list = list.filter(c => c.orders_count === 0);
    }

    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(c =>
      c.full_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q),
    );
  }, [stats, search, filterType]);

  return (
    <>
      <h2 className="font-display font-extrabold text-xl mb-6">Fiches Clients</h2>

      {/* Segmented Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { id: 'all', label: 'Tous', count: stats.length },
          { id: 'buyers', label: 'Clients Acheteurs', count: stats.filter(c => c.orders_count > 0).length },
          { id: 'prospects', label: 'Prospects', count: stats.filter(c => c.orders_count === 0).length },
        ].map(btn => (
          <button
            key={btn.id}
            onClick={() => setFilterType(btn.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              filterType === btn.id
                ? 'bg-[color:var(--primary)] text-white shadow-lg shadow-cyan-500/15'
                : 'bg-[color:var(--bg-card)] hover:bg-[color:var(--bg-card-hover)] text-[color:var(--text-secondary)] border border-[color:var(--border)]'
            }`}
          >
            {btn.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
              filterType === btn.id ? 'bg-white/20 text-white' : 'bg-[color:var(--bg-card-hover)] text-[color:var(--text-muted)]'
            }`}>
              {btn.count}
            </span>
          </button>
        ))}
      </div>

      <div className="glass-card p-4 mb-4" style={{ transform: 'none' }}>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, email ou téléphone..."
          className="form-input"
          aria-label="Rechercher un client"
        />
      </div>
      <div className="glass-card overflow-x-auto" style={{ transform: 'none' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Ville</th>
              <th>Commandes</th>
              <th>Total depense</th>
              <th>Dernier achat</th>
              <th>NPS</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-xs"
                      style={{ background: 'var(--bg-card-hover)', color: 'var(--primary-light)' }}
                    >
                      {c.full_name.split(' ').map(w => w[0]).join('')}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{c.full_name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.email}</div>
                    </div>
                  </div>
                </td>
                <td className="text-sm">{c.city ?? '—'}</td>
                <td className="text-sm font-semibold">{c.orders_count}</td>
                <td className="text-sm font-semibold">{formatCurrency(c.total_spent)}</td>
                <td className="text-sm">{formatDate(c.last_order)}</td>
                <td>
                  {c.nps_score !== null ? (
                    <span className="font-display font-bold" style={{
                      color: c.nps_score >= 9 ? 'var(--success)' : c.nps_score >= 7 ? 'var(--warning)' : 'var(--danger)',
                    }}>{c.nps_score}/10</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </td>
                <td>
                  <button onClick={() => setSelected(c)} className="btn-outline btn-sm"><Eye size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
       {selected && (
        <ClientDetailModal
          user={selected}
          allOrders={allOrders}
          allMaintenance={allMaintenance}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}function getStepIndex(status: string): number {
  switch (status) {
    case 'en_attente': return 0;
    case 'traitee': return 1;
    case 'en_livraison': return 2;
    case 'livree': return 3;
    default: return 0;
  }
}

function ClientDetailModal({
  user,
  allOrders,
  allMaintenance,
  onClose,
}: {
  user: User;
  allOrders: Order[];
  allMaintenance: MaintenanceAlert[];
  onClose: () => void;
}) {
  const orders = allOrders.filter(o => o.user_id === user.id || (user.phone && o.client_phone === user.phone));
  const totalSpent = orders.reduce((s, o) => s + o.total, 0);
  const maintenance = allMaintenance.filter(m => m.user_id === user.id);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-modal-in"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true"
    >
      <div className="glass-card max-w-2xl w-full max-h-[85vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/30" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }} aria-label="Fermer">
          <X size={14} />
        </button>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center font-display font-extrabold text-lg text-white" style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-dark))' }}>
                {user.full_name.split(' ').map(w => w[0]).join('')}
              </div>
              <div>
                <h2 className="font-display font-extrabold text-lg">{user.full_name}</h2>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {user.email} — {user.phone || 'Pas de numéro'}
                </div>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              orders.length > 0
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            }`}>
              {orders.length > 0 ? 'Client Acheteur' : 'Prospect'}
            </span>
          </div>

          {/* Client Details Section */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6 text-xs p-4 rounded-xl bg-[color:var(--bg-surface)] border border-[color:var(--border)]">
            <div>
              <span className="font-bold block mb-1" style={{ color: 'var(--text-muted)' }}>Ville de livraison :</span>
              <span className="text-sm font-medium">{user.city || 'Non renseignée'}</span>
            </div>
            <div>
              <span className="font-bold block mb-1" style={{ color: 'var(--text-muted)' }}>Adresse complète :</span>
              <span className="text-sm font-medium">{user.address || 'Aucune adresse enregistrée'}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="stat-card text-center"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Commandes</div><div className="font-display font-extrabold text-lg">{orders.length}</div></div>
            <div className="stat-card text-center"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Total dépensé</div><div className="font-display font-extrabold text-lg gradient-text">{formatCurrency(totalSpent)}</div></div>
            <div className="stat-card text-center"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>NPS</div><div className="font-display font-extrabold text-lg">{user.nps_score ?? '—'}</div></div>
          </div>

          {orders.length > 0 && (
            <>
              <h3 className="font-display font-semibold text-sm mb-3">Historique & Suivi des commandes</h3>
              <div className="space-y-3 mb-6">
                {orders.map(o => {
                  const currentIdx = getStepIndex(o.status);
                  return (
                    <div key={o.id} className="p-4 rounded-xl text-sm border border-[color:var(--border)] bg-[color:var(--bg-card)]">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-primary-light">{o.order_number}</span>
                          <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>— {formatDate(o.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`badge badge-${o.status}`} style={{ fontSize: '0.65rem' }}>{STATUS_LABELS[o.status]}</span>
                          <span className="font-bold">{formatCurrency(o.total)}</span>
                        </div>
                      </div>

                      {/* Visual Timeline Tracker */}
                      {o.status === 'annulee' ? (
                        <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 font-semibold flex items-center gap-1.5">
                          Commande annulée
                        </div>
                      ) : (
                        <div className="mt-4 pt-3 border-t border-[color:var(--border)]">
                          <div className="relative flex items-center justify-between text-[9px] font-medium">
                            {/* Line backgrounds */}
                            <div className="absolute left-6 right-6 top-2 h-0.5 bg-[color:var(--border)] -z-10" />
                            <div
                              className="absolute left-6 top-2 h-0.5 bg-cyan-500 transition-all -z-10"
                              style={{
                                width: o.status === 'en_attente' ? '0%' :
                                       o.status === 'traitee' ? '33%' :
                                       o.status === 'en_livraison' ? '66%' : '100%'
                              }}
                            />
                            {[
                              { label: 'Reçue', icon: '📥' },
                              { label: 'Validée', icon: '✓' },
                              { label: 'En transit', icon: '🚚' },
                              { label: 'Livrée', icon: '🎁' },
                            ].map((step, sIdx) => {
                              const isDone = currentIdx >= sIdx;
                              return (
                                <div key={step.label} className="flex flex-col items-center flex-1">
                                  <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[8px] border transition-all ${
                                    isDone
                                      ? 'bg-cyan-500 border-cyan-400 text-white shadow-sm shadow-cyan-500/30'
                                      : 'bg-[color:var(--bg-card)] border-[color:var(--border)] text-[color:var(--text-muted)]'
                                  }`}>
                                    {isDone && sIdx !== 0 && sIdx !== 3 ? '✓' : step.icon}
                                  </div>
                                  <span className={`mt-1 font-semibold ${isDone ? 'text-cyan-400' : 'text-[color:var(--text-muted)]'}`}>
                                    {step.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {maintenance.length > 0 && (
            <>
              <h3 className="font-display font-semibold text-sm mb-3">Suivi maintenance</h3>
              <div className="space-y-2">
                {maintenance.map(m => (
                  <div key={m.id} className="p-3 rounded-lg text-sm" style={{ background: 'var(--bg-card)' }}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">{m.product_name}</span>
                      <span className={`badge badge-${m.status}`} style={{ fontSize: '0.65rem' }}>{m.status}</span>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Prochain : {formatDate(m.next_filter_change)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          <button onClick={onClose} className="btn-outline w-full justify-center mt-6">Fermer</button>
        </div>
      </div>
    </div>
  );
}
