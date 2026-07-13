'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ReactNode, useState, useEffect, useCallback } from 'react';
import {
  Box,
  Warehouse,
  Tags,
  TrendingUp,
  LogIn,
  Users,
  Wrench,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { getCurrentUserPermissionsAction } from '@/app/actions/authActions';

const TABS = [
  { id: 'commandes',    label: 'Commandes',     href: '/admin',                  icon: Box },
  { id: 'stocks',       label: 'Stocks',        href: '/admin/stocks',           icon: Warehouse },
  { id: 'catalogue',    label: 'Catalogue',     href: '/admin/catalogue',        icon: Tags },
  { id: 'comptabilite', label: 'Comptabilité',  href: '/admin/comptabilite',     icon: TrendingUp },
  { id: 'maintenance',  label: 'Maintenance',   href: '/admin/maintenance',      icon: Wrench },
  { id: 'personnels',   label: 'Personnels',    href: '/admin/personnels',       icon: Users },
];

const STORAGE_KEY = 'eaumalik.admin.sidebar.collapsed';

export default function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [permissions, setPermissions] = useState<any>(null);
  const [role, setRole] = useState<string>('');
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate le collapse depuis localStorage après le premier paint
  // (évite les mismatches SSR/CSR sur la largeur)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === '1') setCollapsed(true);
    } catch {
      /* localStorage indisponible (mode privé, SSR...) */
    }
    setHydrated(true);
  }, []);

  // Persistance du choix utilisateur
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* silencieux */
    }
  }, [collapsed, hydrated]);

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
    if (tab.id === 'maintenance') return permissions.can_view_comptabilite || role === 'admin';
    if (tab.id === 'personnels') return role === 'admin';

    return true;
  });

  // Détection de l'onglet actif via le pathname (au lieu de `?tab=`)
  const isActive = useCallback(
    (href: string) => {
      if (href === '/admin') return pathname === '/admin';
      return pathname === href || pathname.startsWith(`${href}/`);
    },
    [pathname]
  );

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  return (
    <div className="pt-0 min-h-[calc(100vh-4rem)]">
      <div className="flex" style={{ minHeight: 'calc(100vh - 4rem)' }}>
        <aside
          className={`admin-sidebar ${collapsed ? 'is-collapsed' : ''}`}
          aria-label="Navigation administration"
        >
          <div className="admin-sidebar__header">
            {!collapsed && <span className="admin-sidebar__title">{title}</span>}
            <button
              type="button"
              onClick={toggleCollapsed}
              className="admin-sidebar__toggle"
              aria-label={collapsed ? 'Déployer la barre latérale' : 'Replier la barre latérale'}
              aria-expanded={!collapsed}
              title={collapsed ? 'Déployer' : 'Replier'}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>

          <nav className="admin-sidebar__nav" aria-label="Sections">
            {allowedTabs.map(tab => {
              const Icon = tab.icon;
              const active = isActive(tab.href);
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => router.push(tab.href)}
                  className={`sidebar-link ${active ? 'active' : ''}`}
                  data-tab={tab.id}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? tab.label : undefined}
                >
                  <Icon size={16} aria-hidden="true" className="shrink-0" />
                  {!collapsed && <span className="sidebar-link__label">{tab.label}</span>}
                </button>
              );
            })}
          </nav>

          <div className="admin-sidebar__footer">
            <Link
              href="/login"
              className="sidebar-link"
              title={collapsed ? 'Connexion admin' : undefined}
            >
              <LogIn size={16} aria-hidden="true" className="shrink-0" />
              {!collapsed && <span className="sidebar-link__label">Connexion admin</span>}
            </Link>
          </div>
        </aside>

        <div className="flex-1 p-4 sm:p-6 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
