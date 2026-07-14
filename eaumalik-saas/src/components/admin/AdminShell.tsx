'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ReactNode, useState, useEffect, useCallback } from 'react';
import {
  Warehouse,
  Tags,
  TrendingUp,
  LogIn,
  LogOut,
  Users,
  Wrench,
  Send,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';
import { getCurrentUserPermissionsAction } from '@/app/actions/authActions';
import { useSupabaseAuth } from '@/components/shared/SupabaseAuthProvider';
import { ADMIN_NAV_ITEMS, filterAdminNavItems, type AdminNavItem } from '@/lib/adminNav';

/**
 * Icônes spécifiques à la barre latérale. La source de vérité
 * (libellés, liens, permissions) vit dans `@/lib/adminNav`.
 */
const SIDEBAR_ICONS: Record<string, LucideIcon> = {
  commandes: ShoppingBag,
  stocks: Warehouse,
  catalogue: Tags,
  comptabilite: TrendingUp,
  maintenance: Wrench,
  clients: Users,
  publications: Send,
  personnels: Users,
};

const STORAGE_KEY = 'eaumalik.admin.sidebar.collapsed';

export default function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, signOut, isAdmin } = useSupabaseAuth();

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

  // La sidebar affiche EXACTEMENT les mêmes entrées que le dropdown
  // "Administration" du Navbar (même source, même ordre, même filtrage).
  // Cela inclut '/commandes', qui pointe vers la page autonome dédiée.
  // On utilise le même fallback `isAdmin` que le Navbar pour que les
  // entrées admin-only (publications, personnels) soient visibles dès le
  // premier rendu, avant que `role` ne soit hydraté.
  const allowedTabs = filterAdminNavItems(
    ADMIN_NAV_ITEMS,
    role || (isAdmin ? 'admin' : null),
    permissions,
  );

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
            {allowedTabs.map((tab: AdminNavItem) => {
              const Icon = SIDEBAR_ICONS[tab.id];
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
            {session ? (
              <button
                type="button"
                onClick={async () => { await signOut(); }}
                className="sidebar-link w-full text-left"
                title={collapsed ? 'Déconnexion' : undefined}
              >
                <LogOut size={16} aria-hidden="true" className="shrink-0" />
                {!collapsed && <span className="sidebar-link__label">Déconnexion</span>}
              </button>
            ) : (
              <Link
                href="/login"
                className="sidebar-link"
                title={collapsed ? 'Connexion admin' : undefined}
              >
                <LogIn size={16} aria-hidden="true" className="shrink-0" />
                {!collapsed && <span className="sidebar-link__label">Connexion admin</span>}
              </Link>
            )}
          </div>
        </aside>

        <div className="flex-1 p-4 sm:p-6 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
