'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ReactNode } from 'react';
import { LayoutDashboard, Box, Warehouse, Tags, TrendingUp, LogIn } from 'lucide-react';

const TABS = [
  { id: 'commandes',    label: 'Commandes',     href: '/admin',                  icon: Box },
  { id: 'stocks',       label: 'Stocks',        href: '/admin/stocks',           icon: Warehouse },
  { id: 'catalogue',    label: 'Catalogue',     href: '/admin/catalogue',        icon: Tags },
  { id: 'comptabilite', label: 'Comptabilite',  href: '/admin/comptabilite',     icon: TrendingUp },
];

export default function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const currentTab = params.get('tab') ?? 'commandes';

  const setTab = (tab: string) => router.push(`/admin?tab=${tab}`);

  return (
    <div className="pt-0 min-h-[calc(100vh-4rem)]">
      <div className="flex" style={{ minHeight: 'calc(100vh - 4rem)' }}>
        <aside className="flex flex-col gap-1 p-4 admin-sidebar" style={{ width: 240, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3 px-3">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{title}</span>
            <Link href="/" className="text-xs hover:text-primary-400 transition-colors" style={{ color: 'var(--text-muted)' }}>
              <LayoutDashboard size={14} />
            </Link>
          </div>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => router.push(tab.href)}
                className={`sidebar-link ${active ? 'active' : ''}`}
                data-tab={tab.id}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
          <div className="mt-auto pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <Link href="/login" className="sidebar-link">
              <LogIn size={16} /><span>Connexion admin</span>
            </Link>
          </div>
        </aside>
        <div className="flex-1 p-4 sm:p-6 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
