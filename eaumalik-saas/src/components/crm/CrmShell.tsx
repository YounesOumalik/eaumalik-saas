'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ReactNode } from 'react';
import { Users, Filter } from 'lucide-react';

const TABS = [
  { id: 'maintenance', label: 'Maintenance Filtres', href: '/crm',       icon: Filter },
  { id: 'clients',     label: 'Clients',            href: '/crm/clients', icon: Users },
];

export default function CrmShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get('tab') ?? 'maintenance';

  return (
    <div className="pt-0 min-h-[calc(100vh-4rem)]">
      <div className="flex" style={{ minHeight: 'calc(100vh - 4rem)' }}>
        <aside className="flex flex-col gap-1 p-4 admin-sidebar" style={{ width: 240, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-3 px-3" style={{ color: 'var(--text-muted)' }}>
            CRM
          </div>
          {TABS.map(t => {
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
            <Link href="/" className="sidebar-link"><i className="fa-solid fa-house" /><span>Retour boutique</span></Link>
          </div>
        </aside>
        <div className="flex-1 p-4 sm:p-6 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
