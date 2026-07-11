'use client';

import { useState, useEffect } from 'react';
import type { Order, OrderStatus, OrderItem } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Eye, ArrowRight, FileText } from 'lucide-react';
import { useToast } from '@/components/shared/ToastProvider';
import { getCurrentUserPermissionsAction } from '@/app/actions/authActions';

const STATUS_LABELS: Record<OrderStatus, string> = {
  en_attente:   'En attente',
  traitee:      'Traitee',
  en_livraison: 'En livraison',
  livree:       'Livreee',
  annulee:      'Annulee',
};
const STATUS_CYCLE: OrderStatus[] = ['en_attente', 'traitee', 'en_livraison', 'livree'];

export default function OrdersTable({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [detail, setDetail] = useState<Order | null>(null);
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

  const canValidate = !permissions || role === 'admin' || permissions.can_validate_orders;

  const counts: Record<string, number> = { total: orders.length };
  orders.forEach(o => { counts[o.status] = (counts[o.status] ?? 0) + 1; });

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  const advance = async (id: string) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    const idx = STATUS_CYCLE.indexOf(order.status);
    if (idx < 0 || idx >= STATUS_CYCLE.length - 1) return;
    const nextStatus = STATUS_CYCLE[idx + 1];
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: nextStatus } : o));
    try {
      await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      toast(`${id} -> ${STATUS_LABELS[nextStatus]}`, 'info');
    } catch {
      toast('Erreur reseau (modifie localement)', 'error');
    }
  };

  const generateInvoice = async (id: string) => {
    try {
      const res = await fetch(`/api/invoice?order_id=${id}`);
      if (!res.ok) throw new Error('PDF non genere');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `facture-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast(`Facture generee pour ${id}`, 'success');
    } catch {
      toast('Generation PDF echouee', 'error');
    }
  };

  const stats = [
    { label: 'Total',         val: counts.total,          color: 'var(--primary-light)', bg: 'rgba(8,145,178,0.1)' },
    { label: 'En attente',    val: counts.en_attente || 0, color: '#fbbf24',            bg: 'rgba(245,158,11,0.1)' },
    { label: 'En livraison',  val: counts.en_livraison||0, color: '#22d3ee',            bg: 'rgba(6,182,212,0.1)' },
    { label: 'Livrees',       val: counts.livree || 0,    color: '#34d399',            bg: 'rgba(16,185,129,0.1)' },
    { label: 'Annulees',      val: counts.annulee || 0,   color: '#f87171',            bg: 'rgba(239,68,68,0.1)' },
  ];

  return (
    <>
      <h2 className="font-display font-extrabold text-xl mb-6">Suivi des Commandes</h2>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            <div className="text-2xl font-display font-extrabold" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {(['all', ...STATUS_CYCLE, 'annulee'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={filter === s ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
            >
              {s === 'all' ? 'Toutes' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-x-auto" style={{ transform: 'none' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Commande</th><th>Client</th><th>Date</th><th>Montant</th><th>Statut</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id}>
                <td className="font-semibold text-sm" style={{ color: 'var(--primary-light)' }}>{o.order_number}</td>
                <td>
                  <div className="text-sm font-medium">{o.client_name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.client_city}</div>
                </td>
                <td className="text-sm">{formatDate(o.created_at)}</td>
                <td className="font-semibold text-sm">{formatCurrency(o.total)}</td>
                <td><span className={`badge badge-${o.status}`}><span className="pulse-dot" style={{ width: 6, height: 6, background: o.status === 'en_attente' ? '#fbbf24' : o.status === 'en_livraison' ? '#22d3ee' : 'transparent' }} /> {STATUS_LABELS[o.status]}</span></td>
                <td>
                  <div className="flex gap-1.5">
                    {STATUS_CYCLE.includes(o.status) && canValidate && (
                      <button onClick={() => advance(o.id)} className="btn-primary btn-sm" title="Avancer le statut"><ArrowRight size={12} /></button>
                    )}
                    <button onClick={() => setDetail(o)} className="btn-outline btn-sm" title="Details"><Eye size={12} /></button>
                    {o.status === 'livree' && (
                      <button onClick={() => generateInvoice(o.id)} className="btn-sm btn-success inline-flex items-center gap-1" title="Facture PDF">
                        <FileText size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Aucune commande pour ce filtre.</div>}
      </div>

      {detail && <OrderDetailModal order={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function OrderDetailModal({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-[color:var(--bg-base)] animate-modal-in"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true">
      <div className="glass-card max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-extrabold text-lg">{order.order_number}</h2>
            <span className={`badge badge-${order.status}`}>{STATUS_LABELS[order.status]}</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div className="stat-card"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Client</div><div className="font-semibold text-sm">{order.client_name}</div></div>
            <div className="stat-card"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Telephone</div><div className="font-semibold text-sm">{order.client_phone}</div></div>
            <div className="stat-card"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Adresse</div><div className="text-sm">{order.client_address}, {order.client_city}</div></div>
            <div className="stat-card"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Date</div><div className="text-sm">{formatDate(order.created_at)}</div></div>
          </div>
          <h3 className="font-display font-semibold text-sm mb-3">Articles commandes</h3>
          <div className="space-y-2 mb-4">
            {order.items?.map((i: OrderItem) => (
              <div key={i.id} className="flex justify-between text-sm p-3 rounded-lg" style={{ background: 'var(--bg-card)' }}>
                <span>{i.product_name} <span style={{ color: 'var(--text-muted)' }}>x{i.quantity}</span></span>
                <span className="font-semibold">{formatCurrency(i.line_total)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-display font-extrabold text-lg pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <span>Total</span><span className="gradient-text">{formatCurrency(order.total)}</span>
          </div>
          {order.notes && <div className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>Notes : {order.notes}</div>}
          <button onClick={onClose} className="btn-outline w-full justify-center mt-6">Fermer</button>
        </div>
      </div>
    </div>
  );
}
