'use client';

import { useEffect, useRef } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Order } from '@/types';

interface Props {
  orders: Order[];
}

export default function ComptabiliteDashboard({ orders }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  const delivered = orders.filter(o => o.status === 'livree');
  const totalRevenue = delivered.reduce((s, o) => s + o.total, 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthRevenue = delivered
    .filter(o => o.created_at.startsWith(thisMonth))
    .reduce((s, o) => s + o.total, 0);

  // Agrégation mensuelle (12 mois glissants)
  const monthly = Array(12).fill(0);
  const monthLabels = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];
  delivered.forEach(o => {
    const d = new Date(o.created_at);
    const m = d.getMonth();
    monthly[m] += o.total;
  });

  useEffect(() => {
    let chart: any;
    let cancelled = false;

    (async () => {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);
      if (cancelled || !canvasRef.current) return;
      chart = new Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels: monthLabels,
          datasets: [{
            label: 'Revenus (DH)',
            data: monthly,
            borderColor: '#0891b2',
            backgroundColor: 'rgba(8,145,178,0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#22d3ee',
            pointBorderColor: '#0891b2',
            pointRadius: 5,
            pointHoverRadius: 7,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { family: 'Space Grotesk' } } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { family: 'Space Grotesk' }, callback: (v: any) => v.toLocaleString('fr-MA') + ' DH' }, beginAtZero: true },
          },
        },
      });
      chartRef.current = chart;
    })();

    return () => { cancelled = true; chart?.destroy?.(); };
  }, [JSON.stringify(monthly)]);

  return (
    <>
      <h2 className="font-display font-extrabold text-xl mb-6">Comptabilite</h2>
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="stat-card"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Revenu total (livrees)</div><div className="text-2xl font-display font-extrabold" style={{ color: 'var(--success)' }}>{formatCurrency(totalRevenue)}</div></div>
        <div className="stat-card"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Ce mois</div><div className="text-2xl font-display font-extrabold" style={{ color: 'var(--primary-light)' }}>{formatCurrency(monthRevenue)}</div></div>
        <div className="stat-card"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Commandes livrees</div><div className="text-2xl font-display font-extrabold">{delivered.length}</div></div>
      </div>
      <div className="glass-card p-5 mb-6" style={{ transform: 'none' }}>
        <h3 className="font-display font-semibold text-sm mb-4">Revenus mensuels</h3>
        <div style={{ height: 280 }}><canvas ref={canvasRef} /></div>
      </div>
      <div className="glass-card p-5" style={{ transform: 'none' }}>
        <h3 className="font-display font-semibold text-sm mb-4">Dernieres transactions</h3>
        <div className="space-y-2">
          {delivered.slice(0, 5).map(o => (
            <div key={o.id} className="flex items-center justify-between p-3 rounded-lg text-sm" style={{ background: 'var(--bg-card)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
                  <i className="fa-solid fa-check text-xs" style={{ color: 'var(--success)' }} aria-hidden="true" />
                </div>
                <div>
                  <div className="font-medium">{o.client_name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.order_number} — {formatDate(o.created_at)}</div>
                </div>
              </div>
              <span className="font-semibold" style={{ color: 'var(--success)' }}>+{formatCurrency(o.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
