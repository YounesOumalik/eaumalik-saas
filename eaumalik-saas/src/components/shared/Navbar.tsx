'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSupabaseAuth } from './SupabaseAuthProvider';
import ThemeToggle from './ThemeToggle';
import CartButton from './CartButton';
import { getCurrentUserPermissionsAction } from '@/app/actions/authActions';

const NAV_LINKS = [
  { href: '/', label: 'Accueil' },
  { href: '/boutique', label: 'Boutique' },
];

const ADMIN_LINKS = [
  { id: 'commandes',    href: '/admin?tab=commandes', label: 'Commandes' },
  { id: 'stocks',       href: '/admin?tab=stocks',        label: 'Stocks' },
  { id: 'catalogue',    href: '/admin?tab=catalogue',     label: 'Catalogue' },
  { id: 'comptabilite', href: '/admin?tab=comptabilite',  label: 'Comptabilité' },
  { id: 'personnels',   href: '/admin/personnels?tab=personnels', label: 'Personnels' },
];

const CRM_LINKS = [
  { id: 'maintenance', href: '/crm?tab=maintenance', label: 'Maintenance' },
  { id: 'clients',     href: '/crm/clients?tab=clients',     label: 'Clients' },
  { id: 'messages',    href: '/crm/messages?tab=messages',    label: 'Messages Clients' },
  { id: 'news',        href: '/crm/news?tab=news',        label: 'Publier Actualité' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { session, signOut, isAdmin } = useSupabaseAuth();

  useEffect(() => { setMounted(true); }, []);

  const [permissions, setPermissions] = useState<any>(null);

  useEffect(() => {
    if (!session) return;
    getCurrentUserPermissionsAction().then(res => {
      if (res.success) {
        setPermissions(res.permissions);
      }
    });
  }, [session]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href.split('?')[0]);
  };

  const userRole = isAdmin ? 'admin' : 'client';
  const isStaff = userRole !== 'client';

  const allowedAdminLinks = ADMIN_LINKS.filter(l => {
    if (l.id === 'personnels') return userRole === 'admin';
    return true;
  });

  const allowedCrmLinks = CRM_LINKS.filter(l => {
    if (userRole === 'admin') return true;
    if (!permissions) return true; // show by default while loading

    if (l.id === 'clients') return permissions.can_follow_prospects;
    if (l.id === 'messages') return permissions.can_follow_prospects;
    if (l.id === 'news') return permissions.can_edit_products;
    return true;
  });

  return (
    <nav className="nav-glass fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center" aria-label="EAUMALIK Accueil">
          <div className="h-14 w-40 sm:w-48 relative">
            <Image src="/logo.png" alt="EAUMALIK Logo" fill className="object-contain" unoptimized />
          </div>
        </Link>

        <div className="hidden lg:flex items-center gap-6">
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} className={`nav-link ${isActive(l.href) ? 'active' : ''}`}>
              {l.label}
            </Link>
          ))}

          {session ? (
            <>
              {isStaff ? (
                <>
                  <DropdownMenu title="Administration" links={allowedAdminLinks} isActive={isActive('/admin')} />
                  <DropdownMenu title="CRM" links={allowedCrmLinks} isActive={isActive('/crm')} />
                </>
              ) : (
                <Link href="/client" className={`nav-link ${isActive('/client') ? 'active' : ''}`}>
                  Mon Espace
                </Link>
              )}
              <button
                onClick={async () => { await signOut(); window.location.href = '/'; }}
                className="nav-link text-xs px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold cursor-pointer border border-red-500/20"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <Link href="/login" className="nav-link font-semibold text-[color:var(--primary-light)]">
              Connexion
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <CartButton />
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            aria-label="Ouvrir le menu"
          >
            <i className="fa-solid fa-bars text-base" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile menu rendu via Portal pour échapper au containing block de la nav fixed */}
      {mounted && createPortal(
        <>
          {/* Backdrop sombre derrière le menu */}
          <div
            className={`mobile-menu-backdrop lg:hidden ${mobileOpen ? 'open' : ''}`}
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Panneau latéral */}
          <div
            className={`mobile-menu lg:hidden ${mobileOpen ? 'open' : ''}`}
            id="mobile-menu"
            aria-hidden={!mobileOpen}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              aria-label="Fermer"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href} className="mobile-link" onClick={() => setMobileOpen(false)}>{l.label}</Link>
            ))}
            {session ? (
              <>
                {isStaff ? (
                  <>
                    {allowedAdminLinks.map(l => (
                      <Link key={l.href} href={l.href} className="mobile-link" onClick={() => setMobileOpen(false)}>Admin - {l.label}</Link>
                    ))}
                    {allowedCrmLinks.map(l => (
                      <Link key={l.href} href={l.href} className="mobile-link" onClick={() => setMobileOpen(false)}>CRM - {l.label}</Link>
                    ))}
                  </>
                ) : (
                  <Link href="/client" className="mobile-link" onClick={() => setMobileOpen(false)}>Mon Espace</Link>
                )}
                <button
                  onClick={async () => { await signOut(); window.location.href = '/'; setMobileOpen(false); }}
                  className="mobile-link text-left text-red-400 font-semibold cursor-pointer w-full"
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <Link href="/login" className="mobile-link font-semibold text-[color:var(--primary-light)]" onClick={() => setMobileOpen(false)}>Connexion</Link>
            )}
            <Link href="/panier" className="mobile-link" onClick={() => setMobileOpen(false)}>Panier</Link>
          </div>
        </>,
        document.body
      )}
    </nav>
  );
}

function DropdownMenu({ title, links, isActive }: { title: string; links: { href: string; label: string }[]; isActive: boolean }) {
  return (
    <div className="dropdown relative group">
      <span className={`nav-link ${isActive ? 'active' : ''} flex items-center py-4 cursor-pointer`}>{title} <i className="fa-solid fa-chevron-down text-[0.6rem] ml-1" aria-hidden="true" /></span>
      <div className="dropdown-menu absolute left-0 top-full w-48 flex flex-col bg-[color:var(--bg-surface)] border border-[color:var(--border)] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none group-hover:pointer-events-auto transition-all duration-200 z-50 p-2 gap-1 before:absolute before:-top-4 before:left-0 before:w-full before:h-4">
        {links.map(l => (
          <Link key={l.href} href={l.href} className="dropdown-item flex items-center gap-2.5 px-3 py-2 text-sm text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-card-hover)] hover:text-[color:var(--primary-light)] rounded-lg transition-colors font-medium">
            <i className="fa-solid fa-chevron-right text-[0.65rem] opacity-70" aria-hidden="true" /> {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
