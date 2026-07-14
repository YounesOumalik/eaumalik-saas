'use client';

/**
 * Interface UNIFIÉE de suivi des commandes.
 *
 * Reprend et fusionne les anciennes versions :
 *   - components/crm/CrmOrderTracking.tsx (filtres source + parrainage)
 *   - components/admin/OrdersTable.tsx (validation statut + signature agent)
 *
 * Cette vue est l'unique point d'entrée du personnel (admin, commerciaux,
 * techniciens…) pour suivre / valider les commandes. Elle est désormais
 * servie depuis la barre de navigation principale (Navbar) via `/commandes`.
 *
 * Permissions :
 *   - can_follow_prospects   : voir le suivi et la liste
 *   - can_validate_orders    : en plus, faire avancer / annuler une commande
 *
 * La page serveur qui appelle ce composant applique la garde correspondante
 * (`can_follow_prospects` minimum) ; le gating fin se fait ici côté UI.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Gift,
  ArrowRight,
  Eye,
  XCircle,
  FileText,
  Package,
  Wrench,
  ShoppingBag,
  Users,
  Search,
} from 'lucide-react';
import type { Order, OrderStatus, OrderItem, User } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { OrderProgressBar, OrderTimeline } from '@/components/admin/OrderTracker';
import Dialog from '@/components/ui/Dialog';
import { useToast } from '@/components/shared/ToastProvider';
import {
  getCurrentUserPermissionsAction,
  getCurrentUserAction,
  type CurrentAgentProfile,
} from '@/app/actions/authActions';

const STATUS_LABELS: Record<OrderStatus, string> = {
  en_attente: 'En attente',
  traitee: 'Traitée',
  en_livraison: 'En livraison',
  livree: 'Livrée',
  annulee: 'Annulée',
};
const STATUS_CYCLE: OrderStatus[] = ['en_attente', 'traitee', 'en_livraison', 'livree'];

type SourceFilter = 'all' | 'direct' | 'parrainage';

export default function OrdersView({
  initialOrders,
  clients,
}: {
  initialOrders: Order[];
  clients: User[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all');
  const [filterSource, setFilterSource] = useState<SourceFilter>('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [permissions, setPermissions] = useState<any>(null);
  const [role, setRole] = useState<string>('');
  const [agent, setAgent] = useState<CurrentAgentProfile | null>(null);

  useEffect(() => {
    getCurrentUserPermissionsAction().then(res => {
      if (res.success) {
        setPermissions(res.permissions);
        setRole(res.role || '');
      }
    });
    // Profil complet (id/email/full_name/role) pour signer l'annulation
    // dans l'historique de la commande (`notes`).
    getCurrentUserAction().then(profile => setAgent(profile));
  }, []);

  // L'utilisateur peut faire avancer / annuler une commande uniquement s'il
  // dispose de la permission `can_validate_orders` (les simples commerciaux
  // voient le suivi mais ne valident pas).
  const canValidate = !permissions || role === 'admin' || permissions.can_validate_orders === true;

  // Index clients (par id, et par téléphone pour les commandes invité sans user_id).
  const clientsById = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const clientsByPhone = useMemo(
    () => new Map(clients.filter(c => c.phone).map(c => [c.phone!, c])),
    [clients]
  );

  /** Détermine si une commande a été passée par un client filleul (parrainage). */
  const isReferred = (o: Order): boolean => {
    if (o.user_id) {
      const u = clientsById.get(o.user_id);
      return !!(u && u.referred_by);
    }
    // Commande invité : on tente une correspondance par téléphone.
    if (o.client_phone) {
      const u = clientsByPhone.get(o.client_phone);
      return !!(u && u.referred_by);
    }
    return false;
  };

  /** Renvoie les infos du parrain (parrain de la cliente qui a passé la commande). */
  const getReferrer = (o: Order): User | null => {
    let user: User | undefined;
    if (o.user_id) user = clientsById.get(o.user_id);
    if (!user && o.client_phone) user = clientsByPhone.get(o.client_phone);
    if (!user?.referred_by) return null;
    return clientsById.get(user.referred_by) ?? null;
  };

  const counts = useMemo(() => {
    const out: Record<string, number> = { total: orders.length };
    orders.forEach(o => {
      out[o.status] = (out[o.status] ?? 0) + 1;
      if (isReferred(o)) out.parrainage = (out.parrainage ?? 0) + 1;
      else out.direct = (out.direct ?? 0) + 1;
    });
    return out;
  }, [orders, clientsById, clientsByPhone]);

  const filtered = useMemo(() => {
    let list = orders;
    if (filterStatus !== 'all') list = list.filter(o => o.status === filterStatus);
    if (filterSource === 'direct') list = list.filter(o => !isReferred(o));
    if (filterSource === 'parrainage') list = list.filter(o => isReferred(o));

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(o => {
        const ref = getReferrer(o);
        return (
          o.order_number.toLowerCase().includes(q) ||
          o.client_name.toLowerCase().includes(q) ||
          o.client_phone.includes(q) ||
          o.client_city.toLowerCase().includes(q) ||
          (ref?.full_name.toLowerCase().includes(q) ?? false) ||
          (ref?.referral_code?.toLowerCase().includes(q) ?? false)
        );
      });
    }
    return list;
  }, [orders, filterStatus, filterSource, search, clientsById, clientsByPhone]);

  const advance = async (id: string) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    const idx = STATUS_CYCLE.indexOf(order.status);
    if (idx < 0 || idx >= STATUS_CYCLE.length - 1) return;
    const nextStatus = STATUS_CYCLE[idx + 1];
    setOrders(prev => prev.map(o => (o.id === id ? { ...o, status: nextStatus } : o)));
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.maintenance_created > 0) {
        toast(`${id} -> ${STATUS_LABELS[nextStatus]} (+${data.maintenance_created} maintenance)`, 'info');
      } else {
        toast(`${id} -> ${STATUS_LABELS[nextStatus]}`, 'info');
      }
    } catch {
      toast('Erreur réseau (modifié localement)', 'error');
    }
  };

  const isCancellable = (s: OrderStatus) =>
    s === 'en_attente' || s === 'traitee' || s === 'en_livraison';

  const openCancelDialog = (order: Order) => {
    setCancelTarget(order);
    setCancelReason('');
  };

  const closeCancelDialog = () => {
    if (cancelling) return;
    setCancelTarget(null);
    setCancelReason('');
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const id = cancelTarget.id;
    const reason = cancelReason.trim();
    setCancelling(true);
    setOrders(prev => prev.map(o => (o.id === id ? { ...o, status: 'annulee' } : o)));
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'annulee',
          reason: reason || undefined,
          cancelled_by: agent ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast(
        reason
          ? `Commande ${cancelTarget.order_number} annulée (motif enregistré).`
          : `Commande ${cancelTarget.order_number} annulée.`,
        'success',
      );
      setCancelTarget(null);
      setCancelReason('');
    } catch {
      setOrders(prev =>
        prev.map(o => (o.id === id ? { ...o, status: cancelTarget.status } : o))
      );
      toast('Annulation échouée : vérifiez la connexion.', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const generateInvoice = async (id: string) => {
    try {
      const res = await fetch(`/api/invoice?order_id=${id}`);
      if (!res.ok) throw new Error('PDF non généré');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `facture-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast(`Facture générée pour ${id}`, 'success');
    } catch {
      toast('Génération PDF échouée', 'error');
    }
  };

  const stats = [
    { label: 'Total',         val: counts.total,           color: 'var(--primary-light)', bg: 'rgba(8,145,178,0.1)' },
    { label: 'Directes',      val: counts.direct ?? 0,     color: '#22d3ee',             bg: 'rgba(6,182,212,0.1)' },
    { label: 'Parrainage',    val: counts.parrainage ?? 0, color: '#a78bfa',             bg: 'rgba(167,139,250,0.12)' },
    { label: 'En attente',    val: counts.en_attente ?? 0, color: '#fbbf24',             bg: 'rgba(245,158,11,0.1)' },
    { label: 'En livraison',  val: counts.en_livraison ?? 0, color: '#22d3ee',          bg: 'rgba(6,182,212,0.1)' },
    { label: 'Livrées',       val: counts.livree ?? 0,     color: '#34d399',             bg: 'rgba(16,185,129,0.1)' },
    { label: 'Annulées',      val: counts.annulee ?? 0,    color: '#f87171',             bg: 'rgba(239,68,68,0.1)' },
  ];

  return (
    <>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="font-display font-extrabold text-2xl">Suivi des Commandes</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Commandes passées par les clients — y compris celles issues du <strong>parrainage</strong>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
              {s.label}
            </div>
            <div className="text-2xl font-display font-extrabold" style={{ color: s.color }}>
              {s.val}
            </div>
          </div>
        ))}
      </div>

      {/* Filtres source : Direct vs Parrainage */}
      <div className="flex flex-wrap items-center gap-2 mb-3" role="tablist" aria-label="Filtre par source">
        <span className="text-xs font-bold uppercase tracking-wider mr-1" style={{ color: 'var(--text-muted)' }}>
          Source&nbsp;:
        </span>
        {[
          { id: 'all' as SourceFilter,        label: 'Toutes',     icon: Users },
          { id: 'direct' as SourceFilter,     label: 'Directes',   icon: ShoppingBag },
          { id: 'parrainage' as SourceFilter, label: 'Parrainage', icon: Gift },
        ].map(btn => {
          const Icon = btn.icon;
          const active = filterSource === btn.id;
          return (
            <button
              key={btn.id}
              onClick={() => setFilterSource(btn.id)}
              className={`btn-chip gap-1.5 ${active ? 'active btn-chip-fill' : ''}`}
              role="tab"
              aria-selected={active}
            >
              <Icon size={12} aria-hidden="true" /> {btn.label}
            </button>
          );
        })}
      </div>

      {/* Filtres statut */}
      <div className="flex flex-wrap items-center gap-2 mb-4" role="tablist" aria-label="Filtre par statut">
        <span className="text-xs font-bold uppercase tracking-wider mr-1" style={{ color: 'var(--text-muted)' }}>
          Statut&nbsp;:
        </span>
        {(['all', ...STATUS_CYCLE, 'annulee'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`btn-chip ${filterStatus === s ? (s === 'all' ? 'active btn-chip-fill' : 'active') : ''}`}
          >
            {s === 'all' ? 'Tous' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div className="glass-card p-4 mb-4 flex items-center gap-2" style={{ transform: 'none' }}>
        <Search size={14} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par n° de commande, client, parrain, téléphone, ville…"
          className="form-input flex-1"
          aria-label="Rechercher une commande"
        />
      </div>

      <div className="glass-card overflow-x-auto" style={{ transform: 'none' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Commande</th>
              <th>Client</th>
              <th>Source</th>
              <th>Date</th>
              <th>Montant</th>
              <th>Progression</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => {
              const referred = isReferred(o);
              const referrer = referred ? getReferrer(o) : null;
              return (
                <tr key={o.id}>
                  <td className="font-semibold text-sm" style={{ color: 'var(--primary-light)' }}>
                    {o.order_number}
                  </td>
                  <td>
                    <div className="text-sm font-medium">{o.client_name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {o.client_city}
                    </div>
                  </td>
                  <td>
                    {referred ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{
                          background: 'rgba(167,139,250,0.16)',
                          color: '#a78bfa',
                          border: '1px solid rgba(167,139,250,0.35)',
                        }}
                        title={
                          referrer
                            ? `Parrain : ${referrer.full_name}${referrer.referral_code ? ` (${referrer.referral_code})` : ''}`
                            : 'Client filleul'
                        }
                      >
                        <Gift size={10} aria-hidden="true" /> Parrainage
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{
                          background: 'rgba(6,182,212,0.12)',
                          color: '#22d3ee',
                          border: '1px solid rgba(6,182,212,0.3)',
                        }}
                      >
                        <ShoppingBag size={10} aria-hidden="true" /> Direct
                      </span>
                    )}
                  </td>
                  <td className="text-sm">{formatDate(o.created_at)}</td>
                  <td className="font-semibold text-sm">{formatCurrency(o.total)}</td>
                  <td>
                    <OrderProgressBar order={o} compact />
                  </td>
                  <td>
                    <span className={`badge badge-${o.status}`}>
                      <span
                        className="pulse-dot"
                        style={{
                          width: 6,
                          height: 6,
                          background:
                            o.status === 'en_attente'
                              ? '#fbbf24'
                              : o.status === 'en_livraison'
                                ? '#22d3ee'
                                : 'transparent',
                        }}
                      />
                      {' '}{STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1.5">
                      {STATUS_CYCLE.includes(o.status) && canValidate && (
                        <button
                          onClick={() => advance(o.id)}
                          className="btn-primary btn-sm"
                          title="Avancer le statut"
                        >
                          <ArrowRight size={12} />
                        </button>
                      )}
                      {isCancellable(o.status) && canValidate && (
                        <button
                          onClick={() => openCancelDialog(o)}
                          className="btn-sm btn-danger inline-flex items-center gap-1"
                          title="Annuler (client non confirmé)"
                        >
                          <XCircle size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => setDetail(o)}
                        className="btn-outline btn-sm"
                        title="Détails & suivi"
                      >
                        <Eye size={12} />
                      </button>
                      {o.status === 'livree' && (
                        <button
                          onClick={() => generateInvoice(o.id)}
                          className="btn-sm btn-success inline-flex items-center gap-1"
                          title="Facture PDF"
                        >
                          <FileText size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
            Aucune commande pour ces filtres.
          </div>
        )}
      </div>

      {detail && (
        <OrderDetailModal
          order={detail}
          referrer={getReferrer(detail)}
          isReferred={isReferred(detail)}
          onClose={() => setDetail(null)}
          onOpenMaintenance={() => router.push('/admin/maintenance')}
        />
      )}

      {cancelTarget && (
        <Dialog
          open={true}
          onClose={closeCancelDialog}
          title="Annuler la commande ?"
          subtitle={cancelTarget.order_number}
          icon={<XCircle size={18} />}
          size="sm"
          dismissible={!cancelling}
          footer={
            <div className="flex flex-col-reverse sm:flex-row gap-2 w-full">
              <button
                onClick={closeCancelDialog}
                disabled={cancelling}
                className="btn-outline flex-1 justify-center py-2.5"
              >
                Retour
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancelling}
                className="btn-danger flex-1 justify-center py-2.5 inline-flex items-center gap-1.5"
              >
                <XCircle size={14} />
                {cancelling ? 'Annulation…' : "Confirmer l'annulation"}
              </button>
            </div>
          }
        >
          <div className="space-y-3 text-sm">
            <p style={{ color: 'var(--text-muted)' }}>
              Vous êtes sur le point d&apos;annuler la commande{' '}
              <strong style={{ color: 'var(--text)' }}>{cancelTarget.order_number}</strong>{' '}
              pour <strong style={{ color: 'var(--text)' }}>{cancelTarget.client_name}</strong>.
              Utilisez cette action si le client n&apos;a pas confirmé sa commande.
            </p>
            <label className="block">
              <span
                className="text-xs font-semibold uppercase tracking-wider mb-1.5 block"
                style={{ color: 'var(--text-muted)' }}
              >
                Motif (optionnel)
              </span>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Ex : client injoignable, double commande, erreur de référence…"
                className="input w-full resize-none"
              />
            </label>
            {cancelTarget.status !== 'en_attente' && (
              <div
                className="text-xs px-3 py-2 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171' }}
              >
                Cette commande est déjà au statut{' '}
                <strong>{STATUS_LABELS[cancelTarget.status]}</strong>. Confirmez uniquement si vous êtes
                certain de vouloir l&apos;annuler.
              </div>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}

function OrderDetailModal({
  order,
  referrer,
  isReferred,
  onClose,
  onOpenMaintenance,
}: {
  order: Order;
  referrer: User | null;
  isReferred: boolean;
  onClose: () => void;
  onOpenMaintenance: () => void;
}) {
  return (
    <Dialog
      open={true}
      onClose={onClose}
      title={order.order_number}
      icon={<ShoppingBag size={18} />}
      size="lg"
      footer={
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          {order.status === 'livree' && (
            <button
              onClick={onOpenMaintenance}
              className="btn-outline flex-1 justify-center py-2.5 inline-flex items-center gap-1.5"
            >
              <Wrench size={14} /> Suivi maintenance
            </button>
          )}
          <button
            onClick={onClose}
            className="btn-primary flex-1 justify-center py-2.5 sm:flex-none sm:min-w-[160px]"
          >
            Fermer
          </button>
        </div>
      }
    >
      <div className="flex items-center justify-between mb-6 -mt-2">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Détails de la commande
        </span>
        <div className="flex items-center gap-2">
          {isReferred && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: 'rgba(167,139,250,0.16)',
                color: '#a78bfa',
                border: '1px solid rgba(167,139,250,0.35)',
              }}
            >
              <Gift size={10} /> Parrainage
            </span>
          )}
          <span className={`badge badge-${order.status}`}>{STATUS_LABELS[order.status]}</span>
        </div>
      </div>

      {/* Bandeau parrainage */}
      {isReferred && referrer && (
        <div
          className="mb-4 px-3 py-2.5 rounded-xl flex items-center gap-3 text-xs"
          style={{ background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.3)' }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold"
            style={{ background: 'rgba(167,139,250,0.2)', color: '#a78bfa' }}
          >
            {referrer.full_name.split(' ').map(w => w[0]).join('')}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
              Commande parrainée par {referrer.full_name}
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              Code parrain&nbsp;: <span className="font-mono font-semibold">{referrer.referral_code}</span>
              {referrer.email && <> · {referrer.email}</>}
              {referrer.phone && <> · {referrer.phone}</>}
            </div>
          </div>
          <Gift size={20} style={{ color: '#a78bfa' }} aria-hidden="true" />
        </div>
      )}

      {/* Timeline de suivi visuel */}
      <div className="mb-6">
        <h3 className="font-display font-semibold text-sm mb-3 flex items-center gap-2">
          <Package size={14} /> Suivi de la livraison
        </h3>
        <OrderTimeline order={order} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="stat-card">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            Client
          </div>
          <div className="font-semibold text-sm">{order.client_name}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            Téléphone
          </div>
          <div className="font-semibold text-sm">{order.client_phone}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            Adresse
          </div>
          <div className="text-sm">
            {order.client_address}, {order.client_city}
          </div>
        </div>
        <div className="stat-card">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            Date
          </div>
          <div className="text-sm">{formatDate(order.created_at)}</div>
        </div>
      </div>
      <h3 className="font-display font-semibold text-sm mb-3">Articles commandés</h3>
      <div className="space-y-2 mb-4">
        {order.items?.map((i: OrderItem) => (
          <div
            key={i.id}
            className="flex justify-between text-sm p-3 rounded-lg"
            style={{ background: 'var(--bg-card)' }}
          >
            <span>
              {i.product_name} <span style={{ color: 'var(--text-muted)' }}>x{i.quantity}</span>
            </span>
            <span className="font-semibold">{formatCurrency(i.line_total)}</span>
          </div>
        ))}
      </div>
      <div
        className="flex justify-between font-display font-extrabold text-lg pt-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <span>Total</span>
        <span className="gradient-text">{formatCurrency(order.total)}</span>
      </div>
      {order.notes && (
        <div className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          Notes : {order.notes}
        </div>
      )}
    </Dialog>
  );
}