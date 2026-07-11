'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ReactNode, useState, useEffect } from 'react';
import { Users, Filter, MessageSquare, Newspaper, Home } from 'lucide-react';
import { getCurrentUserPermissionsAction } from '@/app/actions/authActions';

const TABS = [
  { id: 'maintenance', label: 'Maintenance Filtres', href: '/crm',          icon: Filter },
  { id: 'clients',     label: 'Clients',            href: '/crm/clients',     icon: Users },
  { id: 'messages',    label: 'Messages Clients',   href: '/crm/messages',    icon: MessageSquare },
  { id: 'news',        label: 'Publier Actualité',  href: '/crm/news',        icon: Newspaper },
];

export default function CrmShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get('tab') ?? 'maintenance';

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

  const allowedTabs = TABS.filter(t => {
    if (!permissions) return true;
    if (role === 'admin') return true;

    if (t.id === 'clients') return permissions.can_follow_prospects;
    if (t.id === 'messages') return permissions.can_follow_prospects;
    if (t.id === 'news') return permissions.can_edit_products;
    return true;
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
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => router.push(t.href + (t.id === 'maintenance' ? '?tab=maintenance' : ''))}
                className={`sidebar-link ${active ? 'active' : ''}`}
                data-tab={t.id}
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
