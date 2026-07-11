'use client';

import { useEffect, useRef, useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Order, Product } from '@/types';
import { Settings, TrendingUp, Calculator, DollarSign, Wrench, Truck } from 'lucide-react';

interface Props {
  orders: Order[];
  products: Product[];
}

export default function ComptabiliteDashboard({ orders, products }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  // Persistent settings state using localStorage
  const [commRate, setCommRate] = useState<number>(10); // % of selling price
  const [techComm, setTechComm] = useState<number>(150); // DH fixed per order
  const [transCost, setTransCost] = useState<number>(50); // DH fixed per order
  const [maintCost, setMaintCost] = useState<number>(100); // DH fixed per order
  const [fallbackCostPct, setFallbackCostPct] = useState<number>(50); // % of price if wholesale_price missing

  // Load configuration on mount
  useEffect(() => {
    const savedComm = localStorage.getItem('fin_comm_rate');
    const savedTech = localStorage.getItem('fin_tech_comm');
    const savedTrans = localStorage.getItem('fin_trans_cost');
    const savedMaint = localStorage.getItem('fin_maint_cost');
    const savedFallback = localStorage.getItem('fin_fallback_pct');

    if (savedComm) setCommRate(Number(savedComm));
    if (savedTech) setTechComm(Number(savedTech));
    if (savedTrans) setTransCost(Number(savedTrans));
    if (savedMaint) setMaintCost(Number(savedMaint));
    if (savedFallback) setFallbackCostPct(Number(savedFallback));
  }, []);

  // Save configuration on change
  const saveSetting = (key: string, val: number, setter: (v: number) => void) => {
    setter(val);
    localStorage.setItem(key, String(val));
  };

  // Filter only delivered orders for actual finance calculations
  const delivered = orders.filter(o => o.status === 'livree');

  // Mapping products for fast lookup
  const productMap = new Map<string, Product>();
  products.forEach(p => productMap.set(p.id, p));

  // Compute stats
  let totalRevenue = 0;
  let totalWholesaleCost = 0;
  let totalTransport = 0;
  let totalCommerciaux = 0;
  let totalTechnicians = 0;
  let totalMaintenance = 0;

  // Track transaction breakdowns
  const transactions = delivered.map(o => {
    const revenue = o.total;
    totalRevenue += revenue;

    // Transport cost
    const trans = transCost;
    totalTransport += trans;

    // Technician commission
    const tech = techComm;
    totalTechnicians += tech;

    // Maintenance cost
    const maint = maintCost;
    totalMaintenance += maint;

    // Wholesale purchase cost
    let wholesale = 0;
    o.items?.forEach(i => {
      const p = productMap.get(i.product_id);
      const wPrice = p?.wholesale_price ?? (i.unit_price * fallbackCostPct) / 100;
      wholesale += wPrice * i.quantity;
    }) ?? 0;
    totalWholesaleCost += wholesale;

    // Commercial commission
    let comm = (o.subtotal * commRate) / 100;
    totalCommerciaux += comm;

    const totalCharges = wholesale + trans + tech + maint + comm;
    const netMargin = revenue - totalCharges;

    return {
      order: o,
      revenue,
      wholesale,
      comm,
      tech,
      trans,
      maint,
      totalCharges,
      netMargin,
    };
  });

  const totalChargesAll = totalWholesaleCost + totalTransport + totalCommerciaux + totalTechnicians + totalMaintenance;
  const netMarginAll = totalRevenue - totalChargesAll;
  const marginPct = totalRevenue > 0 ? (netMarginAll / totalRevenue) * 100 : 0;

  // Monthly aggregation for Chart.js
  const monthlyRevenue = Array(12).fill(0);
  const monthlyMargin = Array(12).fill(0);
  const monthLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

  transactions.forEach(t => {
    const d = new Date(t.order.created_at);
    const m = d.getMonth();
    monthlyRevenue[m] += t.revenue;
    monthlyMargin[m] += t.netMargin;
  });

  useEffect(() => {
    let chart: any;
    let cancelled = false;

    (async () => {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);
      if (cancelled || !canvasRef.current) return;
      chart = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels: monthLabels,
          datasets: [
            {
              label: 'Revenus (DH)',
              data: monthlyRevenue,
              backgroundColor: 'rgba(8,145,178,0.4)',
              borderColor: '#0891b2',
              borderWidth: 1,
            },
            {
              label: 'Marge Nette (DH)',
              data: monthlyMargin,
              backgroundColor: 'rgba(52,211,153,0.4)',
              borderColor: '#34d399',
              borderWidth: 1,
            }
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Space Grotesk' } } } },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { family: 'Space Grotesk' } } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { family: 'Space Grotesk' }, callback: (v: any) => v.toLocaleString('fr-MA') + ' DH' }, beginAtZero: true },
          },
        },
      });
      chartRef.current = chart;
    })();

    return () => { cancelled = true; chart?.destroy?.(); };
  }, [JSON.stringify(monthlyRevenue), JSON.stringify(monthlyMargin)]);

  return (
    <>
      <h2 className="font-display font-extrabold text-xl mb-6">Comptabilité & Analyse des Marges</h2>

      {/* Margins configuration panel */}
      <div className="glass-card p-6 mb-6" style={{ transform: 'none' }}>
        <h3 className="font-display font-bold text-base mb-4 flex items-center gap-2">
          <Settings size={18} className="text-primary-light" /> Configuration des charges & commissions
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="form-label text-xs">Com. Commercial (%)</label>
            <input
              type="number"
              className="form-input text-sm"
              value={commRate}
              onChange={e => saveSetting('fin_comm_rate', Number(e.target.value), setCommRate)}
            />
          </div>
          <div>
            <label className="form-label text-xs">Com. Technicien (DH)</label>
            <input
              type="number"
              className="form-input text-sm"
              value={techComm}
              onChange={e => saveSetting('fin_tech_comm', Number(e.target.value), setTechComm)}
            />
          </div>
          <div>
            <label className="form-label text-xs">Frais de Transport (DH)</label>
            <input
              type="number"
              className="form-input text-sm"
              value={transCost}
              onChange={e => saveSetting('fin_trans_cost', Number(e.target.value), setTransCost)}
            />
          </div>
          <div>
            <label className="form-label text-xs">Provision Maintenance (DH)</label>
            <input
              type="number"
              className="form-input text-sm"
              value={maintCost}
              onChange={e => saveSetting('fin_maint_cost', Number(e.target.value), setMaintCost)}
            />
          </div>
          <div>
            <label className="form-label text-xs">Coût d&apos;achat estimé (%)</label>
            <input
              type="number"
              className="form-input text-sm"
              value={fallbackCostPct}
              onChange={e => saveSetting('fin_fallback_pct', Number(e.target.value), setFallbackCostPct)}
            />
          </div>
        </div>
      </div>

      {/* Main Financial Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Revenu total</div>
          <div className="text-2xl font-display font-extrabold text-cyan-400">{formatCurrency(totalRevenue)}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Total achat de gros</div>
          <div className="text-2xl font-display font-extrabold text-red-400">{formatCurrency(totalWholesaleCost)}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Total charges & coms</div>
          <div className="text-2xl font-display font-extrabold text-amber-500">{formatCurrency(totalChargesAll - totalWholesaleCost)}</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05))', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div className="text-xs mb-1" style={{ color: '#34d399' }}>Marge nette réelle</div>
          <div className="text-2xl font-display font-extrabold text-emerald-400">
            {formatCurrency(netMarginAll)}
            <span className="text-xs font-semibold block text-emerald-300">({marginPct.toFixed(1)}% de marge)</span>
          </div>
        </div>
      </div>

      {/* Dynamic Charges breakdown */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 glass-card p-5" style={{ transform: 'none' }}>
          <h3 className="font-display font-semibold text-sm mb-4">Évolution des marges</h3>
          <div style={{ height: 280 }}><canvas ref={canvasRef} /></div>
        </div>

        <div className="glass-card p-5" style={{ transform: 'none' }}>
          <h3 className="font-display font-semibold text-sm mb-4">Répartition des charges</h3>
          <div className="space-y-3.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><DollarSign size={14} className="text-red-400" /> Achat en gros</span>
              <span className="font-semibold">{formatCurrency(totalWholesaleCost)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><TrendingUp size={14} className="text-amber-400" /> Com. Commerciaux</span>
              <span className="font-semibold">{formatCurrency(totalCommerciaux)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><Wrench size={14} className="text-cyan-400" /> Com. Techniciens</span>
              <span className="font-semibold">{formatCurrency(totalTechnicians)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><Truck size={14} className="text-indigo-400" /> Transport</span>
              <span className="font-semibold">{formatCurrency(totalTransport)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><Calculator size={14} className="text-sky-400" /> Provision Maintenance</span>
              <span className="font-semibold">{formatCurrency(totalMaintenance)}</span>
            </div>
            <div className="pt-3 border-t border-[color:var(--border)] flex items-center justify-between text-sm font-bold">
              <span>Total charges</span>
              <span className="text-red-400">{formatCurrency(totalChargesAll)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Margin details per transaction */}
      <div className="glass-card p-5" style={{ transform: 'none' }}>
        <h3 className="font-display font-semibold text-sm mb-4">Rentabilité par commande</h3>
        <div className="overflow-x-auto">
          <table className="data-table text-xs">
            <thead>
              <tr>
                <th>Commande</th>
                <th>Revenu</th>
                <th>Achat Gros</th>
                <th>Com. Com.</th>
                <th>Com. Tech.</th>
                <th>Transport</th>
                <th>Maint.</th>
                <th>Marge nette</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.order.id}>
                  <td className="font-semibold text-primary-light">{t.order.order_number}</td>
                  <td className="font-bold">{formatCurrency(t.revenue)}</td>
                  <td className="text-red-400">{formatCurrency(t.wholesale)}</td>
                  <td>{formatCurrency(t.comm)}</td>
                  <td>{formatCurrency(t.tech)}</td>
                  <td>{formatCurrency(t.trans)}</td>
                  <td>{formatCurrency(t.maint)}</td>
                  <td className={`font-bold ${t.netMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(t.netMargin)}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-6" style={{ color: 'var(--text-muted)' }}>
                    Aucune transaction disponible pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
