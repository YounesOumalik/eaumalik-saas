'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Warehouse, TrendingUp, TrendingDown, AlertTriangle, Package,
  Boxes, ArrowUpRight, ArrowDownRight, ExternalLink, Activity, PackagePlus,
} from 'lucide-react';
import { Chart, registerables } from 'chart.js';
import type { Product, ProductRestock, ProductCategory } from '@/types';
import { CATEGORY_LABELS } from '@/types';
import RestockDialog from '@/components/admin/RestockDialog';

Chart.register(...registerables);

interface Props {
  products: Product[];
  history: ProductRestock[];
}

/** Capacité max par catégorie (utilisée pour normaliser les barres de capacité). */
const CATEGORY_CAPACITY: Record<ProductCategory, number> = {
  purificateurs: 60,
  industriel: 30,
  consommables: 120,
};

const CATEGORY_DEPOSITS: Record<ProductCategory, { code: string; city: string }> = {
  purificateurs: { code: 'D-CASA-01', city: 'Casablanca — Roches Noires' },
  industriel: { code: 'D-CASA-02', city: 'Casablanca — Atelier pro' },
  consommables: { code: 'D-CASA-03', city: 'Casablanca — Pièces & filtres' },
};

export default function StocksDashboard({ products, history }: Props) {
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);
  // Article dont on déclenche un mouvement de stock.
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);

  // ---------- KPIs ----------
  const kpis = useMemo(() => {
    const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
    const lowStock = products.filter(p => p.stock <= p.stock_alert_threshold);
    const outOfStock = products.filter(p => p.stock === 0);
    const critical = products.filter(p => p.stock > 0 && p.stock <= p.stock_alert_threshold);
    const inventoryValue = products.reduce((sum, p) => sum + p.stock * (p.wholesale_price ?? p.price * 0.5), 0);

    // Mouvements sur 14 jours glissants
    const since = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const recent = history.filter(h => new Date(h.created_at).getTime() >= since);
    const entries = recent.filter(h => h.quantity > 0).reduce((s, h) => s + h.quantity, 0);
    const exits = recent.filter(h => h.quantity < 0).reduce((s, h) => s + Math.abs(h.quantity), 0);

    return { totalUnits, lowStock, outOfStock, critical, inventoryValue, entries, exits, recent };
  }, [products, history]);

  // ---------- Capacité par "dépôt" (catégorie) ----------
  const deposits = useMemo(() => {
    const cats: ProductCategory[] = ['purificateurs', 'industriel', 'consommables'];
    return cats.map(cat => {
      const prods = products.filter(p => p.category === cat);
      const used = prods.reduce((s, p) => s + p.stock, 0);
      const cap = Math.max(CATEGORY_CAPACITY[cat], used);
      const ratio = cap > 0 ? (used / cap) * 100 : 0;
      const reference = prods[0];
      return {
        category: cat,
        label: CATEGORY_LABELS[cat],
        deposit: CATEGORY_DEPOSITS[cat],
        productCount: prods.length,
        used,
        capacity: cap,
        ratio,
        lowStock: prods.filter(p => p.stock <= p.stock_alert_threshold).length,
      };
    });
  }, [products]);

  // ---------- Catégories (regroupement pour le tableau) ----------
  const grouped = useMemo(() => {
    const order: ProductCategory[] = ['purificateurs', 'industriel', 'consommables'];
    return order
      .map(cat => ({
        category: cat,
        label: CATEGORY_LABELS[cat],
        deposit: CATEGORY_DEPOSITS[cat],
        items: products.filter(p => p.category === cat && !p.is_archived),
      }))
      .filter(g => g.items.length > 0);
  }, [products]);

  // ---------- Graphique mouvements 14j ----------
  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }
    const days: string[] = [];
    const entriesByDay: number[] = [];
    const exitsByDay: number[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      days.push(d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
      entriesByDay.push(0);
      exitsByDay.push(0);
    }
    const start = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000).getTime();
    for (const h of history) {
      const t = new Date(h.created_at).getTime();
      if (t < start) continue;
      const dayIndex = Math.floor((t - start) / (24 * 60 * 60 * 1000));
      if (dayIndex < 0 || dayIndex > 13) continue;
      if (h.quantity > 0) entriesByDay[dayIndex] += h.quantity;
      else exitsByDay[dayIndex] += Math.abs(h.quantity);
    }
    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;
    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [
          {
            label: 'Entrées',
            data: entriesByDay,
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'Sorties',
            data: exitsByDay,
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderColor: 'rgba(239, 68, 68, 1)',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { family: 'Space Grotesk', size: 12 } },
          },
          tooltip: {
            callbacks: { label: (c) => `${c.dataset.label} : ${c.parsed.y} unités` },
          },
        },
        scales: {
          x: {
            stacked: false,
            ticks: { color: '#94a3b8', font: { size: 11 } },
            grid: { color: 'rgba(14,165,233,0.08)' },
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#94a3b8', font: { size: 11 }, precision: 0 },
            grid: { color: 'rgba(14,165,233,0.08)' },
          },
        },
      },
    });
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [history]);

  // ---------- Mouvement de stock ----------
  // Ouvre la modale RestockDialog pour l'article ciblé. Après confirmation
  // et écriture serveur, on recharge la page (les `products` et `history`
  // du dashboard sont SSR-fetched) pour rafraîchir les KPIs et le tableau.
  const openMovement = (p: Product) => setRestockTarget(p);
  const closeMovement = () => setRestockTarget(null);

  return (
    <div className="space-y-6" style={{ transform: 'none' }}>
      {/* EN-TÊTE */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-extrabold text-xl">Gestion des Stocks</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Vue d&rsquo;ensemble des niveaux de stock, mouvements récents et alertes.
          </p>
        </div>
        <Link href="/admin/catalogue" className="btn-outline btn-sm">
          <ExternalLink size={14} /> Ouvrir le catalogue complet
        </Link>
      </div>

      {/* KPIs */}
      <div className="dashboard-grid">
        <KpiCard
          icon={<Boxes size={20} />}
          label="Stock total"
          value={`${kpis.totalUnits}`}
          unit="unités"
          accent="primary"
        />
        <KpiCard
          icon={<TrendingUp size={20} />}
          label="Entrées (14j)"
          value={`+${kpis.entries}`}
          unit="unités"
          accent="success"
        />
        <KpiCard
          icon={<TrendingDown size={20} />}
          label="Sorties (14j)"
          value={`-${kpis.exits}`}
          unit="unités"
          accent="danger"
        />
        <KpiCard
          icon={<AlertTriangle size={20} />}
          label="Alertes actives"
          value={`${kpis.lowStock.length}`}
          unit={kpis.outOfStock.length > 0 ? `dont ${kpis.outOfStock.length} en rupture` : 'produits'}
          accent="warning"
        />
      </div>

      {/* MOUVEMENT + CAPACITÉ */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="glass-card p-5 lg:col-span-2" style={{ transform: 'none' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={16} style={{ color: 'var(--primary-light)' }} />
              <h3 className="font-display font-bold text-sm">Mouvement de stock — 14 derniers jours</h3>
            </div>
            <div className="flex gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <span className="flex items-center gap-1"><span className="legend-dot legend-dot--success" /> Entrées</span>
              <span className="flex items-center gap-1"><span className="legend-dot legend-dot--danger" /> Sorties</span>
            </div>
          </div>
          <div style={{ height: 240 }}>
            <canvas ref={chartRef} />
          </div>
        </div>

        <div className="glass-card p-5" style={{ transform: 'none' }}>
          <div className="flex items-center gap-2 mb-3">
            <Warehouse size={16} style={{ color: 'var(--primary-light)' }} />
            <h3 className="font-display font-bold text-sm">Capacité des dépôts</h3>
          </div>
          <div className="space-y-3">
            {deposits.map(d => (
              <div key={d.category}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex flex-col">
                    <span className="font-semibold text-xs">{d.label}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {d.deposit.code} • {d.deposit.city}
                    </span>
                  </div>
                  <span className="text-xs font-bold">
                    {d.used}<span style={{ color: 'var(--text-muted)' }}>/{d.capacity}</span>
                  </span>
                </div>
                <div className="capacity-bar">
                  <div
                    className={`capacity-bar__fill ${d.ratio >= 90 ? 'is-danger' : d.ratio >= 70 ? 'is-warning' : 'is-ok'}`}
                    style={{ width: `${Math.min(100, d.ratio)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  <span>{d.productCount} articles</span>
                  {d.lowStock > 0 && (
                    <span className="flex items-center gap-1" style={{ color: 'var(--warning)' }}>
                      <AlertTriangle size={10} /> {d.lowStock} alerte{d.lowStock > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ALERTES */}
      {kpis.lowStock.length > 0 && (
        <div className="glass-card p-5" style={{ transform: 'none' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
            <h3 className="font-display font-bold text-sm">
              Articles à surveiller ({kpis.lowStock.length})
            </h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {kpis.lowStock.map(p => (
              <Link
                key={p.id}
                href="/admin/catalogue"
                className="alert-tile"
                title="Voir dans le catalogue"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{p.name}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {CATEGORY_DEPOSITS[p.category].code}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm" style={{ color: p.stock === 0 ? 'var(--danger)' : 'var(--warning)' }}>
                      {p.stock}
                    </div>
                    <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      seuil {p.stock_alert_threshold}
                    </div>
                  </div>
                </div>
                {p.stock === 0 && (
                  <div className="badge badge-annulee mt-2 text-[9px]">
                    <AlertTriangle size={9} /> Rupture totale
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* TABLEAU PAR CATÉGORIE / DÉPÔT */}
      <div className="space-y-4">
        {grouped.map(group => (
          <div key={group.category} className="glass-card overflow-hidden" style={{ transform: 'none' }}>
            <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Package size={14} style={{ color: 'var(--primary-light)' }} />
                <h3 className="font-display font-bold text-sm">{group.label}</h3>
                <span className="badge badge-traitee text-[10px]">{group.items.length} articles</span>
              </div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Dépôt : <span className="font-semibold" style={{ color: 'var(--text)' }}>{group.deposit.code}</span> — {group.deposit.city}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Article</th>
                    <th style={{ width: 80 }}>Stock</th>
                    <th style={{ width: 90 }}>Seuil</th>
                    <th style={{ width: 160 }}>Niveau</th>
                    <th style={{ width: 230 }}>Mouvement de stock</th>
                    <th style={{ width: 110 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map(p => {
                    const isOut = p.stock === 0;
                    const isLow = !isOut && p.stock <= p.stock_alert_threshold;
                    const max = Math.max(50, p.stock_alert_threshold * 4);
                    const pct = Math.min(100, (p.stock / max) * 100);
                    const color = isOut ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--success)';
                    return (
                      <tr key={p.id}>
                        <td className="text-sm font-medium">
                          <div className="flex flex-col">
                            <span>{p.name}</span>
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              {group.deposit.code}
                              {p.is_featured && <> • ⭐ Vedette</>}
                            </span>
                          </div>
                        </td>
                        <td className="font-bold text-sm" style={{ color }}>
                          {p.stock}
                          {isOut && <span className="ml-1 text-[9px]" style={{ color: 'var(--danger)' }}>Rupture</span>}
                        </td>
                        <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.stock_alert_threshold}</td>
                        <td>
                          <div className="stock-bar">
                            <div className="stock-bar__fill" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => openMovement(p)}
                            className="btn-primary btn-sm w-full justify-center"
                            title={`Enregistrer un mouvement de stock pour « ${p.name} »`}
                          >
                            <PackagePlus size={14} /> Mouvement de stock
                          </button>
                        </td>
                        <td>
                          <Link
                            href="/admin/catalogue"
                            className="btn-outline btn-sm w-full justify-center"
                            title="Voir / modifier dans le catalogue"
                          >
                            <ExternalLink size={12} /> Catalogue
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* MOUVEMENTS RÉCENTS */}
      {history.length > 0 && (
        <div className="glass-card p-5" style={{ transform: 'none' }}>
          <div className="flex items-center gap-2 mb-3">
            <Activity size={16} style={{ color: 'var(--primary-light)' }} />
            <h3 className="font-display font-bold text-sm">Derniers mouvements</h3>
          </div>
          <div className="space-y-2">
            {history.slice(0, 8).map(h => {
              const product = products.find(p => p.id === h.product_id);
              const isEntry = h.quantity > 0;
              return (
                <div key={h.id} className="movement-row">
                  <div className="movement-row__icon" style={{ color: isEntry ? 'var(--success)' : 'var(--danger)' }}>
                    {isEntry ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">
                      {product?.name ?? 'Produit inconnu'}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {new Date(h.created_at).toLocaleString('fr-FR')} • {h.created_by ?? '—'}
                      {h.note && <> • {h.note}</>}
                    </div>
                  </div>
                  <div
                    className="font-bold text-sm shrink-0"
                    style={{ color: isEntry ? 'var(--success)' : 'var(--danger)' }}
                  >
                    {isEntry ? '+' : ''}{h.quantity}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modale Mouvement de stock — même composant que celui du catalogue */}
      <RestockDialog
        open={restockTarget !== null}
        product={restockTarget}
        onClose={closeMovement}
        onRestocked={() => {
          // Le dashboard est SSR-fetched : on recharge pour rafraîchir KPIs,
          // graphique, alertes et le stock de chaque article.
          if (typeof window !== 'undefined') window.location.reload();
        }}
      />
    </div>
  );
}

function KpiCard({
  icon, label, value, unit, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  accent: 'primary' | 'success' | 'danger' | 'warning';
}) {
  return (
    <div className={`kpi-card kpi-card--${accent}`}>
      <div className={`kpi-card__icon kpi-card__icon--${accent}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="kpi-card__label">{label}</div>
        <div className="kpi-card__value">{value}</div>
        <div className="kpi-card__unit">{unit}</div>
      </div>
    </div>
  );
}
