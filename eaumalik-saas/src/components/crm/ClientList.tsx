'use client';

import { useState, useMemo } from 'react';
import { Eye, X } from 'lucide-react';
import type { User, Order, OrderStatus } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { MOCK_ORDERS, MOCK_MAINTENANCE } from '@/data/mock';

const STATUS_LABELS: Record<OrderStatus, string> = {
  en_attente: 'En attente',
  traitee: 'Traitee',
  en_livraison: 'En livraison',
  livree: 'Livreee',
  annulee: 'Annulee',
};

export default function ClientList({ initialClients }: { initialClients: User[] }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<User | null>(null);

  const stats = useMemo(() => {
    return initialClients.map(c => {
      const orders = MOCK_ORDERS.filter(o => o.user_id === c.id);
      return {
        ...c,
        orders_count: orders.length,
        total_spent: orders.reduce((s, o) => s + o.total, 0),
        last_order: orders[0]?.created_at ?? c.created_at,
      };
    });
  }, [initialClients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stats;
    return stats.filter(c =>
      c.full_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q),
    );
  }, [stats, search]);

  return (
    <>
      <h2 className="font-display font-extrabold text-xl mb-6">Fiches Clients</h2>
      <div className="glass-card p-4 mb-4" style={{ transform: 'none' }}>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, email ou telephone..."
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
      {selected && <ClientDetailModal user={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function ClientDetailModal({ user, onClose }: { user: User; onClose: () => void }) {
  const orders = MOCK_ORDERS.filter(o => o.user_id === user.id);
  const totalSpent = orders.reduce((s, o) => s + o.total, 0);
  const maintenance = MOCK_MAINTENANCE.filter(m => m.user_id === user.id);

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
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center font-display font-extrabold text-lg text-white" style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-dark))' }}>
              {user.full_name.split(' ').map(w => w[0]).join('')}
            </div>
            <div>
              <h2 className="font-display font-extrabold text-lg">{user.full_name}</h2>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {user.email} — {user.phone}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="stat-card text-center"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Commandes</div><div className="font-display font-extrabold text-lg">{orders.length}</div></div>
            <div className="stat-card text-center"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Total depense</div><div className="font-display font-extrabold text-lg gradient-text">{formatCurrency(totalSpent)}</div></div>
            <div className="stat-card text-center"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>NPS</div><div className="font-display font-extrabold text-lg">{user.nps_score ?? '—'}</div></div>
          </div>
          {orders.length > 0 && (
            <>
              <h3 className="font-display font-semibold text-sm mb-3">Historique des commandes</h3>
              <div className="space-y-2 mb-4">
                {orders.map(o => (
                  <div key={o.id} className="flex items-center justify-between p-3 rounded-lg text-sm" style={{ background: 'var(--bg-card)' }}>
                    <div><span className="font-medium" style={{ color: 'var(--primary-light)' }}>{o.order_number}</span> — {formatDate(o.created_at)}</div>
                    <div className="flex items-center gap-3">
                      <span className={`badge badge-${o.status}`} style={{ fontSize: '0.65rem' }}>{STATUS_LABELS[o.status]}</span>
                      <span className="font-semibold">{formatCurrency(o.total)}</span>
                    </div>
                  </div>
                ))}
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
