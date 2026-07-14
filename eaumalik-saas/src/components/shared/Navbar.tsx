'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Droplets } from 'lucide-react';
import { useSupabaseAuth } from './SupabaseAuthProvider';
import ThemeToggle from './ThemeToggle';
import CartButton from './CartButton';
import { getCurrentUserPermissionsAction } from '@/app/actions/authActions';
import { ADMIN_NAV_ITEMS, filterAdminNavItems } from '@/lib/adminNav';

const NAV_LINKS = [
  { href: '/#accueil', label: 'Accueil' },
  { href: '/#filtration', label: 'Filtration' },
  { href: '/#catalogue', label: 'Catalogue' },
  { href: '/#industriel', label: 'Professionnels' },
  { href: '/boutique', label: 'Boutique' },
  { href: '/#contact', label: 'Contact' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { session, signOut, isAdmin } = useSupabaseAuth();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const [permissions, setPermissions] = useState<any>(null);
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    if (!session) return;
    getCurrentUserPermissionsAction().then(res => {
      if (res.success) {
        setPermissions(res.permissions);
        setRole(res.role || '');
      }
    });
  }, [session]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href.split('?')[0]);
  };

  // Rôle réel (admin, client, technician, sales…) prioritaire sur isAdmin.
  const userRole = role || (isAdmin ? 'admin' : 'client');
  const hasAnyPermission = !!permissions && Object.values(permissions).some(Boolean);
  const isStaff = userRole !== 'client' && (userRole === 'admin' || hasAnyPermission);

  // Source de vérité partagée avec AdminShell — toute modification
  // (ajout, suppression, permission, libellé) se répercute ici aussi.
  const allowedAdminLinks = filterAdminNavItems(
    ADMIN_NAV_ITEMS,
    role || (isAdmin ? 'admin' : null),
    permissions,
  );

  const linkClass = 'px-4 py-2 rounded-full text-sm font-semibold text-stone-600 hover:text-brand-600 hover:bg-brand-50 transition-colors';

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-cream/85 backdrop-blur-md border-b border-stone-200 shadow-sm' : 'bg-cream/40 backdrop-blur-sm'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-20">
        <Link href="/" className="flex items-center gap-2 group" aria-label="EauMalik Accueil">
          <span className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
            <Droplets className="w-5 h-5" />
          </span>
          <span className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
            Eau<span className="text-brand-600">Malik</span>
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} className={linkClass}>{l.label}</Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <CartButton />
          {session ? (
            <div className="hidden lg:flex items-center gap-1">
              {isStaff ? (
                <DropdownMenu title="Administration" links={allowedAdminLinks} isActive={isActive('/admin')} />
              ) : (
                <Link href="/client" className={linkClass}>Mon Espace</Link>
              )}
              <button
                onClick={async () => { await signOut(); window.location.href = '/'; }}
                className="px-3 py-2 rounded-full text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
              >
                Déconnexion
              </button>
            </div>
          ) : (
            <Link href="/login" className="hidden lg:inline-flex px-5 py-2.5 rounded-full text-sm font-bold text-white bg-brand-600 hover:bg-brand-500 transition-colors">
              Connexion
            </Link>
          )}

          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl flex items-center justify-center bg-stone-100 text-stone-700"
            aria-label="Ouvrir le menu"
          >
            <i className="fa-solid fa-bars text-base" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile menu rendu via Portal pour échapper au containing block de la nav fixed */}
      {mounted && createPortal(
        <>
          <div
            className={`mobile-menu-backdrop lg:hidden ${mobileOpen ? 'open' : ''}`}
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            className={`mobile-menu lg:hidden ${mobileOpen ? 'open' : ''}`}
            id="mobile-menu"
            aria-hidden={!mobileOpen}
            style={{ background: '#FDFCF8' }}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg flex items-center justify-center bg-stone-100 text-stone-700"
              aria-label="Fermer"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href} className="mobile-link" style={{ color: '#44403c' }} onClick={() => setMobileOpen(false)}>{l.label}</Link>
            ))}
            {session ? (
              <>
                {isStaff ? (
                  allowedAdminLinks.map(l => (
                    <Link key={l.href} href={l.href} className="mobile-link" style={{ color: '#44403c' }} onClick={() => setMobileOpen(false)}>Admin - {l.label}</Link>
                  ))
                ) : (
                  <Link href="/client" className="mobile-link" style={{ color: '#44403c' }} onClick={() => setMobileOpen(false)}>Mon Espace</Link>
                )}
                <button
                  onClick={async () => { await signOut(); window.location.href = '/'; setMobileOpen(false); }}
                  className="mobile-link text-left font-semibold cursor-pointer w-full"
                  style={{ color: '#ef4444' }}
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <Link href="/login" className="mobile-link font-semibold" style={{ color: '#0d9488' }} onClick={() => setMobileOpen(false)}>Connexion</Link>
            )}
            <Link href="/panier" className="mobile-link" style={{ color: '#44403c' }} onClick={() => setMobileOpen(false)}>Panier</Link>
          </div>
        </>,
        document.body
      )}
    </nav>
  );
}

function DropdownMenu({ title, links, isActive }: { title: string; links: { href: string; label: string }[]; isActive: boolean }) {
  return (
    <div className="relative group">
      <span className={`flex items-center py-2 px-4 rounded-full cursor-pointer text-sm font-semibold text-stone-600 hover:text-brand-600 hover:bg-brand-50 transition-colors ${isActive ? 'text-brand-600 bg-brand-50' : ''}`}>
        {title} <i className="fa-solid fa-chevron-down text-[0.6rem] ml-1" aria-hidden="true" />
      </span>
      <div className="absolute left-0 top-full w-52 flex flex-col bg-white border border-stone-200 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none group-hover:pointer-events-auto transition-all duration-200 z-50 p-2 gap-1 before:absolute before:-top-4 before:left-0 before:w-full before:h-4">
        {links.map(l => (
          <Link key={l.href} href={l.href} className="flex items-center gap-2.5 px-3 py-2 text-sm text-stone-600 hover:bg-brand-50 hover:text-brand-600 rounded-lg transition-colors font-medium">
            <i className="fa-solid fa-chevron-right text-[0.65rem] opacity-70" aria-hidden="true" /> {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
