'use client';

import { useMemo } from 'react';
import {
  Package, ClipboardCheck, Truck, Home, ShieldCheck, X, Clock,
  CheckCircle2, Circle,
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { Order, OrderStatus, OrderTimelineStep } from '@/types';

// ============================================================================
// Composant de suivi visuel d'une commande (style livraison professionnelle).
// Deux représentations :
//   1) <OrderProgressBar /> : barre horizontale synthétique (5 étapes + %)
//   2) <OrderTimeline />    : timeline verticale détaillée (étapes franchies
//                              avec date + description, style "DHL / FedEx")
// ============================================================================

const STEP_DEFINITIONS: Array<{
  key: OrderTimelineStep['key'];
  label: string;
  description: string;
  iconName: OrderTimelineStep['iconName'];
}> = [
  { key: 'commande',     label: 'Commande reçue',  description: 'Votre commande a été enregistrée et le paiement confirmé.', iconName: 'Package' },
  { key: 'en_attente',   label: 'En préparation',  description: 'Préparation de votre commande dans notre entrepôt.',           iconName: 'Clock' },
  { key: 'traitee',      label: 'Préparée',        description: 'Emballage & contrôle qualité terminés. Prête à expédier.',       iconName: 'ClipboardCheck' },
  { key: 'en_livraison', label: 'En livraison',    description: 'Prise en charge par notre équipe de livraison.',                  iconName: 'Truck' },
  { key: 'livree',       label: 'Livrée',          description: 'Commande livrée et installée. Maintenance active.',               iconName: 'Home' },
];

const ANNULLED_LABEL = 'Commande annulée';
const ANNULLED_DESC = 'Cette commande a été annulée. Aucun frais n\'a été facturé.';

function buildSteps(order: Order): OrderTimelineStep[] {
  if (order.status === 'annulee') {
    return [{
      key: 'annulee' as OrderTimelineStep['key'],
      label: ANNULLED_LABEL,
      description: ANNULLED_DESC,
      at: order.updated_at,
      state: 'cancelled',
      iconName: 'X',
    }];
  }
  // Déterminer l'étape "courante" (la plus avancée franchie par la commande)
  const orderIndex: Record<string, number> = {
    commande: 0,
    en_attente: 1,
    traitee: 2,
    en_livraison: 3,
    livree: 4,
  };
  const currentIdx = orderIndex[order.status] ?? 0;
  const datesByStatus: Record<string, string | null> = {
    commande: order.created_at,
    en_attente: order.created_at,
    traitee: order.processed_at || null,
    en_livraison: order.shipped_at || null,
    livree: order.delivered_at || null,
  };

  return STEP_DEFINITIONS.map((def, idx) => {
    let state: OrderTimelineStep['state'];
    if (idx < currentIdx) state = 'done';
    else if (idx === currentIdx) state = 'current';
    else state = 'upcoming';
    return {
      ...def,
      at: datesByStatus[def.key as string] ?? null,
      state,
    };
  });
}

export function useOrderTimeline(order: Order): OrderTimelineStep[] {
  return useMemo(() => buildSteps(order), [order]);
}

// ----------------------------------------------------------------------------
// Barre de progression horizontale (utilisée dans le tableau de commandes)
// ----------------------------------------------------------------------------
export function OrderProgressBar({ order, compact = false }: { order: Order; compact?: boolean }) {
  const pctByStatus: Record<OrderStatus, number> = {
    en_attente: 20,
    traitee: 50,
    en_livraison: 75,
    livree: 100,
    annulee: 0,
  };
  const totalSteps = STEP_DEFINITIONS.length - 1; // 4 transitions visibles
  const pct = pctByStatus[order.status];

  // Pour "en_attente" on est entre étape 1 et 2, etc.
  const stepIdx = (() => {
    if (order.status === 'annulee') return -1;
    const map: Record<OrderStatus, number> = {
      en_attente: 1,   // commande reçue✓, en attente (préparation) en cours
      traitee: 2,
      en_livraison: 3,
      livree: 4,
      annulee: 0,
    };
    return map[order.status];
  })();

  if (order.status === 'annulee') {
    return (
      <div className={`order-progress order-progress--cancelled ${compact ? 'is-compact' : ''}`}>
        <div className="order-progress__bar" style={{ width: '100%', background: 'linear-gradient(90deg,#fda4af,#f87171)' }} />
        <span className="order-progress__label" style={{ color: '#f87171' }}>Annulée</span>
      </div>
    );
  }

  return (
    <div className={`order-progress ${compact ? 'is-compact' : ''}`} title={`${pct}% complété`}>
      <div className="order-progress__bar">
        <div className="order-progress__bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="order-progress__dots">
        {STEP_DEFINITIONS.map((def, idx) => {
          const isPast = idx < stepIdx;
          const isCurrent = idx === stepIdx;
          const isFuture = idx > stepIdx;
          const dotClass = isPast ? 'is-done' : isCurrent ? 'is-current' : 'is-future';
          return (
            <div key={def.key as string} className={`order-progress__dot ${dotClass}`} title={def.label}>
              {isPast && !compact ? <CheckCircle2 size={10} /> : <span>{idx + 1}</span>}
            </div>
          );
        })}
      </div>
      <div className="order-progress__label">
        {Math.round(pct)}% — étape {stepIdx}/{totalSteps}
      </div>
      <style>{orderProgressCss}</style>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Timeline verticale détaillée (affichée dans le modal de détail)
// ----------------------------------------------------------------------------
function IconFor(name: OrderTimelineStep['iconName']) {
  switch (name) {
    case 'Package':       return <Package size={16} />;
    case 'ClipboardCheck': return <ClipboardCheck size={16} />;
    case 'Truck':         return <Truck size={16} />;
    case 'Home':          return <Home size={16} />;
    case 'ShieldCheck':   return <ShieldCheck size={16} />;
    case 'X':             return <X size={16} />;
    case 'Clock':         return <Clock size={16} />;
    case 'CheckCircle2':  return <CheckCircle2 size={16} />;
    default:              return <Circle size={16} />;
  }
}

export function OrderTimeline({ order }: { order: Order }) {
  const steps = useOrderTimeline(order);

  return (
    <div className="order-timeline" aria-label="Chronologie de la commande">
      {/* Header — transporteur + tracking */}
      <div className="order-timeline__header">
        <div>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Transporteur
          </div>
          <div className="font-semibold text-sm">{order.carrier || 'EAUMALIK Express'}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            N° de suivi
          </div>
          <div className="font-mono text-sm font-semibold">{order.tracking_number || order.order_number}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Montant
          </div>
          <div className="font-semibold text-sm">{formatCurrency(order.total)}</div>
        </div>
      </div>

      {/* Barre de progression globale */}
      <div className="order-timeline__progressWrap">
        <OrderProgressBar order={order} />
      </div>

      {/* Liste verticale chronologique */}
      <ol className="order-timeline__list">
        {steps.map((s, idx) => {
          const isLast = idx === steps.length - 1;
          return (
            <li key={s.key as string} className={`order-timeline__item is-${s.state}`}>
              <div className="order-timeline__bullet">
                <div className="order-timeline__dot">{IconFor(s.iconName)}</div>
                {!isLast && <div className="order-timeline__line" />}
              </div>
              <div className="order-timeline__content">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="font-semibold text-sm">{s.label}</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {s.at ? formatDateTime(s.at) : s.state === 'upcoming' ? '—' : ''}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{s.description}</p>
                {s.state === 'current' && order.status !== 'annulee' && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(8,145,178,0.12)', color: 'var(--primary-light)' }}>
                    <span className="pulse-dot" style={{ width: 6, height: 6, background: 'var(--primary-light)' }} /> En cours
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Estimation de livraison si pas encore livrée */}
      {order.status !== 'livree' && order.status !== 'annulee' && order.estimated_delivery && (
        <div className="order-timeline__eta">
          <Clock size={14} aria-hidden="true" />
          <span>Livraison estimée : <strong>{formatDateTime(order.estimated_delivery)}</strong></span>
        </div>
      )}

      <style>{timelineCss}</style>
    </div>
  );
}

// ----------------------------------------------------------------------------
// CSS scopé via <style> (le projet utilise Tailwind sans CSS-in-JS)
// ----------------------------------------------------------------------------
const orderProgressCss = `
.order-progress {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 160px;
}
.order-progress.is-compact { min-width: 120px; gap: 0.25rem; }
.order-progress__bar {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: rgba(15,118,110,0.12);
  overflow: hidden;
}
.order-progress__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--primary-light));
  border-radius: 999px;
  transition: width 0.6s cubic-bezier(.22,1,.36,1);
  box-shadow: 0 0 12px rgba(34,211,238,0.4);
}
.order-progress__dots {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.order-progress__dot {
  width: 18px; height: 18px;
  border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700;
  background: var(--bg-card);
  border: 2px solid rgba(15,118,110,0.25);
  color: var(--text-muted);
  transition: all .3s ease;
}
.order-progress__dot.is-done {
  background: var(--primary);
  border-color: var(--primary-light);
  color: #0f3a3a;
  box-shadow: 0 0 8px rgba(34,211,238,0.5);
}
.order-progress__dot.is-current {
  background: var(--primary-light);
  border-color: var(--primary-light);
  color: #0a1f1f;
  transform: scale(1.15);
  box-shadow: 0 0 0 4px rgba(34,211,238,0.2);
  animation: op-pulse 1.6s ease-in-out infinite;
}
.order-progress__dot.is-future { opacity: 0.6; }
.order-progress__label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  text-transform: uppercase;
}
.order-progress--cancelled {
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  position: relative;
}
@keyframes op-pulse {
  0%, 100% { box-shadow: 0 0 0 4px rgba(34,211,238,0.2); }
  50%      { box-shadow: 0 0 0 8px rgba(34,211,238,0.05); }
}
`;

const timelineCss = `
.order-timeline {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0;
}
.order-timeline__header {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  background: rgba(8,145,178,0.08);
  border: 1px solid rgba(8,145,178,0.18);
}
@media (max-width: 640px) {
  .order-timeline__header { grid-template-columns: 1fr 1fr; }
}
.order-timeline__progressWrap { padding: 0 0.5rem; }
.order-timeline__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.order-timeline__item {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 0.75rem;
  padding-bottom: 1.25rem;
}
.order-timeline__item:last-child { padding-bottom: 0; }
.order-timeline__bullet {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.order-timeline__dot {
  width: 28px; height: 28px;
  border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-card);
  border: 2px solid rgba(15,118,110,0.3);
  color: var(--text-muted);
  z-index: 1;
}
.order-timeline__line {
  flex: 1;
  width: 2px;
  background: linear-gradient(180deg, rgba(15,118,110,0.4), rgba(15,118,110,0.1));
  margin-top: 4px;
  min-height: 30px;
}
.order-timeline__item.is-done .order-timeline__dot {
  background: var(--primary);
  border-color: var(--primary-light);
  color: #fff;
  box-shadow: 0 0 10px rgba(34,211,238,0.5);
}
.order-timeline__item.is-current .order-timeline__dot {
  background: var(--primary-light);
  border-color: var(--primary-light);
  color: #0a1f1f;
  box-shadow: 0 0 0 4px rgba(34,211,238,0.2);
  animation: op-pulse 1.6s ease-in-out infinite;
}
.order-timeline__item.is-cancelled .order-timeline__dot {
  background: #f87171;
  border-color: #fca5a5;
  color: #fff;
}
.order-timeline__content {
  padding-top: 4px;
}
.order-timeline__eta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.85rem;
  border-radius: 10px;
  background: rgba(245,158,11,0.08);
  border: 1px dashed rgba(245,158,11,0.35);
  color: #fbbf24;
  font-size: 0.78rem;
}
`;
