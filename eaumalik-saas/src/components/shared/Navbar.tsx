'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Droplets } from 'lucide-react';
import { useSupabaseAuth } from './SupabaseAuthProvider';
import ThemeToggle from './ThemeToggle';
import CartButton from './CartButton';
import BrandLogo from './BrandLogo';
import { getCurrentUserPermissionsAction } from '@/app/actions/authActions';
import { ADMIN_NAV_ITEMS, filterAdminNavItems } from '@/lib/adminNav';

const NAV_LINKS = [
  { href: '/#accueil', label: 'Accueil' },
  { href: '/#filtration', label: 'Filtration' },
  { href: '/#offres', label: 'Promotion' },
  { href: '/#catalogue', label: 'Catalogue' },
  { href: '/#industriel', label: 'Professionnels' },
  { href: '/boutique', label: 'Boutique' },
  { href: '/#contact', label: 'Contact' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
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
  // L'interface d'administration (dropdown navbar + onglets AdminShell) est
  // strictement réservée aux rôles admin-staff (superadmin + administrator).
  // Le personnel classique (commercial, technicien, etc.) n'y a plus accès,
  // même s'il dispose de permissions ciblées sur des sous-modules —
  // l'interface d'admin reste unifiée.
  const isAdminStaff = userRole === 'admin' || userRole === 'administrator';
  // Conservé pour la compatibilité (utilisé ailleurs) : vrai si l'utilisateur
  // est du personnel staff (rôle non-client). Devient équivalent à isAdminStaff
  // désormais : le personnel classique ne voit plus le dropdown "Administration".
  const isStaff = isAdminStaff;

  // Source de vérité partagée avec AdminShell — toute modification
  // (ajout, suppression, permission, libellé) se répercute ici aussi.
  const allowedAdminLinks = filterAdminNavItems(
    ADMIN_NAV_ITEMS,
    role || (isAdmin ? 'admin' : null),
    permissions,
  );

  // Classe theme-aware : `nav-link` (cf. globals.css) gère les 2 modes via
  // var(--text-secondary) + var(--primary-light).
  const linkClass = 'nav-link px-4 py-2 rounded-full';

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'nav-glass shadow-sm' : 'nav-glass'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-20">
        <Link href="/" className="flex items-center gap-2 group" aria-label="EauMalik Accueil">
          <BrandLogo size="md" priority className="group-hover:opacity-90 transition-opacity" />
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
                onClick={async () => {
                  await signOut();
                  // signOut() a déjà vidé le state React (mise à jour
                  // optimiste). On force le re-fetch des server components
                  // pour que les pages cachées (panier, compte, etc.)
                  // re-rendent l'état « déconnecté », puis on redirige.
                  router.refresh();
                  router.push('/');
                }}
                className="px-3 py-2 rounded-full text-sm font-semibold transition-colors"
                style={{ color: 'var(--danger)' }}
              >
                Déconnexion
              </button>
            </div>
          ) : (
            <Link href="/login" className="hidden lg:inline-flex px-5 py-2.5 rounded-full text-sm font-bold btn-primary">
              Connexion
            </Link>
          )}

          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl flex items-center justify-center surface-solid border-soft"
            style={{ color: 'var(--text)' }}
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
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg flex items-center justify-center surface-solid border-soft"
              style={{ color: 'var(--text)' }}
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
                  allowedAdminLinks.map(l => (
                    <Link key={l.href} href={l.href} className="mobile-link" onClick={() => setMobileOpen(false)}>Admin - {l.label}</Link>
                  ))
                ) : (
                  <Link href="/client" className="mobile-link" onClick={() => setMobileOpen(false)}>Mon Espace</Link>
                )}
                <button
                  onClick={async () => {
                    setMobileOpen(false);
                    await signOut();
                    router.refresh();
                    router.push('/');
                  }}
                  className="mobile-link text-left font-semibold cursor-pointer w-full"
                  style={{ color: 'var(--danger)' }}
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <Link href="/login" className="mobile-link font-semibold" style={{ color: 'var(--primary)' }} onClick={() => setMobileOpen(false)}>Connexion</Link>
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
    <div className="relative group">
      <span className={`nav-link flex items-center px-4 py-2 rounded-full ${isActive ? 'active' : ''}`}>
        {title} <i className="fa-solid fa-chevron-down text-[0.6rem] ml-1" aria-hidden="true" />
      </span>
      <div
        className="absolute left-0 top-full w-52 flex flex-col rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none group-hover:pointer-events-auto transition-all duration-200 z-50 p-2 gap-1 before:absolute before:-top-4 before:left-0 before:w-full before:h-4 surface-solid border-soft"
      >
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className="nav-link flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg font-medium"
            style={{ background: 'transparent' }}
          >
            <i className="fa-solid fa-chevron-right text-[0.65rem] opacity-70" aria-hidden="true" /> {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
