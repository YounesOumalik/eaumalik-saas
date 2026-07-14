'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ReactNode, useState, useEffect } from 'react';
import { Users, Filter, MessageSquare, Home, ShoppingBag } from 'lucide-react';
import { getCurrentUserPermissionsAction } from '@/app/actions/authActions';

const TABS = [
  { id: 'maintenance',  label: 'Maintenance Filtres', href: '/crm',             permission: 'can_view_products',    icon: Filter },
  { id: 'clients',      label: 'Clients',             href: '/crm/clients',      permission: 'can_follow_prospects', icon: Users },
  { id: 'messages',     label: 'Messages Clients',    href: '/crm/messages',     permission: 'can_follow_prospects', icon: MessageSquare },
];

export default function CrmShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '/crm';

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

  // Onglet actif dérivé du pathname (et non plus seulement du query param),
  // pour que l'élément actif reflète toujours l'URL courante (ex. /crm/clients
  // → "Clients" est actif, pas "Maintenance Filtres").
  const activeId = (() => {
    if (pathname.startsWith('/crm/messages')) return 'messages';
    if (pathname.startsWith('/crm/clients')) return 'clients';
    return 'maintenance';
  })();

  const allowedTabs = TABS.filter(t => {
    if (!permissions) return true; // permissions pas encore chargées : on ne masque rien
    if (role === 'admin') return true; // admin a tout, peu importe les booleens
    const perm = (t as any).permission;
    return !perm || permissions[perm] === true;
  });

  return (
    <div className="pt-0 min-h-[calc(100vh-4rem)]">
      <div className="flex" style={{ minHeight: 'calc(100vh - 4rem)' }}>
        <aside className="flex flex-col gap-1 p-4 admin-sidebar" style={{ width: 240, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-3 px-3" style={{ color: 'var(--text-muted)' }}>
            CRM
          </div>
          {allowedTabs.map(t => {
            const Icon = t.icon;
            const active = activeId === t.id;
            // On aligne l'URL cible sur l'onglet actif : on inclut ?tab=<id>
            // pour que les liens partagés / marque-pages gardent la cohérence
            // avec useSearchParams ailleurs dans l'app (Navbar dropdown).
            const href = t.href === '/crm' ? '/crm?tab=maintenance' : `${t.href}?tab=${t.id}`;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => router.push(href)}
                className={`sidebar-link ${active ? 'active' : ''}`}
                data-tab={t.id}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={16} aria-hidden="true" /> <span>{t.label}</span>
              </button>
            );
          })}
          <div className="mt-auto pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <Link href="/" className="sidebar-link">
              <Home size={16} /><span>Retour boutique</span>
            </Link>
          </div>
        </aside>
        <div className="flex-1 p-4 sm:p-6 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
