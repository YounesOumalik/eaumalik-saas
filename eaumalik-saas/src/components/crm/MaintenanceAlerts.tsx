'use client';

import { useState } from 'react';
import { Bell, ShoppingCart } from 'lucide-react';
import type { MaintenanceAlert, MaintenanceStatus } from '@/types';
import { formatDate, daysUntil } from '@/lib/utils';
import { useToast } from '@/components/shared/ToastProvider';
import { useCart } from '@/components/shared/CartProvider';
import { MOCK_PRODUCTS } from '@/data/mock';

const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  a_jour:          'A jour',
  a_renouveler:    'A renouveler',
  expire:          'Expire',
  rappel_envoye:   'Rappel envoye',
  commande_creee:  'Commande créée',
};

export default function MaintenanceAlerts({ initialAlerts }: { initialAlerts: MaintenanceAlert[] }) {
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>(initialAlerts);
  const toast = useToast();
  const { add } = useCart();

  const counts = {
    total: alerts.length,
    expired: alerts.filter(m => m.status === 'expire').length,
    renewing: alerts.filter(m => m.status === 'a_renouveler').length,
    ok: alerts.filter(m => m.status === 'a_jour').length,
  };

  const sendReminder = async (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'rappel_envoye' } : a));
    try {
      await fetch(`/api/maintenance/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rappel_envoye' }),
      });
    } catch {}
    const a = alerts.find(x => x.id === id);
    if (a) toast(`Rappel envoye a ${a.product_name}`, 'success');
  };

  const createReplacementOrder = (id: string) => {
    const a = alerts.find(x => x.id === id);
    if (!a) return;
    MOCK_PRODUCTS.filter(p => p.category === 'consommables').forEach(p => {
      add({
        product_id: p.id,
        name: p.name,
        price: p.price,
        image_url: p.image_url,
        quantity: 1,
      });
    });
    setAlerts(prev => prev.map(x => x.id === id ? { ...x, status: 'commande_creee' } : x));
    toast(`Filtres de remplacement ajoutes au panier (${a.product_name})`, 'success');
  };

  return (
    <>
      <h2 className="font-display font-extrabold text-xl mb-6">Suivi Maintenance Filtres</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="stat-card"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Total installations</div><div className="text-2xl font-display font-extrabold">{counts.total}</div></div>
        <div className="stat-card"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Filtres expires</div><div className="text-2xl font-display font-extrabold" style={{ color: 'var(--danger)' }}>{counts.expired}</div></div>
        <div className="stat-card"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>A renouveler</div><div className="text-2xl font-display font-extrabold" style={{ color: 'var(--warning)' }}>{counts.renewing}</div></div>
        <div className="stat-card"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>A jour</div><div className="text-2xl font-display font-extrabold" style={{ color: 'var(--success)' }}>{counts.ok}</div></div>
      </div>

      <div className="glass-card overflow-x-auto" style={{ transform: 'none' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Produit installe</th>
              <th>Installation</th>
              <th>Prochain changement</th>
              <th>Jours</th>
              <th>Filtres</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map(m => {
              const days = daysUntil(m.next_filter_change);
              const daysColor = days < 0 ? 'var(--danger)' : days < 30 ? 'var(--warning)' : 'var(--success)';
              return (
                <tr key={m.id}>
                  <td className="text-sm font-medium">{m.product_name}</td>
                  <td className="text-sm">{m.product_name.split(' ')[0]}...</td>
                  <td className="text-sm">{formatDate(m.install_date)}</td>
                  <td className="text-sm font-medium">{formatDate(m.next_filter_change)}</td>
                  <td><span className="font-display font-bold text-sm" style={{ color: daysColor }}>{days < 0 ? `${Math.abs(days)}j de retard` : `${days}j`}</span></td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {m.filter_types.map(f => (
                        <span key={f} className="text-[0.65rem] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}>{f}</span>
                      ))}
                    </div>
                  </td>
                  <td><span className={`badge badge-${m.status}`}>{STATUS_LABELS[m.status]}</span></td>
                  <td>
                    <div className="flex gap-1.5">
                      {m.status !== 'a_jour' && m.status !== 'commande_creee' && (
                        <>
                          <button onClick={() => sendReminder(m.id)} className="btn-outline btn-sm" title="Envoyer rappel"><Bell size={12} /></button>
                          <button onClick={() => createReplacementOrder(m.id)} className="btn-primary btn-sm" title="Commander filtres"><ShoppingCart size={12} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
