'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ReactNode, useState, useEffect } from 'react';
import { LayoutDashboard, Box, Warehouse, Tags, TrendingUp, LogIn, Users } from 'lucide-react';
import { getCurrentUserPermissionsAction } from '@/app/actions/authActions';

const TABS = [
  { id: 'commandes',    label: 'Commandes',     href: '/admin',                  icon: Box },
  { id: 'stocks',       label: 'Stocks',        href: '/admin/stocks',           icon: Warehouse },
  { id: 'catalogue',    label: 'Catalogue',     href: '/admin/catalogue',        icon: Tags },
  { id: 'comptabilite', label: 'Comptabilite',  href: '/admin/comptabilite',     icon: TrendingUp },
  { id: 'personnels',   label: 'Personnels',    href: '/admin/personnels',       icon: Users },
];

export default function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const currentTab = params.get('tab') ?? 'commandes';

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

  const allowedTabs = TABS.filter(tab => {
    if (!permissions) return true;
    if (role === 'admin') return true;

    if (tab.id === 'commandes') return permissions.can_validate_orders;
    if (tab.id === 'stocks') return permissions.can_view_stocks;
    if (tab.id === 'catalogue') return permissions.can_view_products;
    if (tab.id === 'comptabilite') return permissions.can_view_comptabilite;
    if (tab.id === 'personnels') return role === 'admin';

    return true;
  });

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
          {allowedTabs.map(tab => {
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
