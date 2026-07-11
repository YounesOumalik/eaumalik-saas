'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import ThemeToggle from './ThemeToggle';
import CartButton from './CartButton';

const NAV_LINKS = [
  { href: '/', label: 'Accueil' },
  { href: '/boutique', label: 'Boutique' },
];

const ADMIN_LINKS = [
  { href: '/admin?tab=commandes', label: 'Commandes' },
  { href: '/admin?tab=stocks', label: 'Stocks' },
  { href: '/admin?tab=catalogue', label: 'Catalogue' },
  { href: '/admin?tab=comptabilite', label: 'Comptabilite' },
];

const CRM_LINKS = [
  { href: '/crm?tab=maintenance', label: 'Maintenance' },
  { href: '/crm?tab=clients', label: 'Clients' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href.split('?')[0]);
  };

  return (
    <nav className="nav-glass fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2.5" aria-label="EAUMALIK Accueil">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-dark))' }}>
            <i className="fa-solid fa-droplet text-white text-sm" aria-hidden="true" />
          </div>
          <span className="font-display font-extrabold text-lg tracking-tight" style={{ color: 'var(--text)' }}>
            Eau<span className="gradient-text">Malik</span>
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-6">
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} className={`nav-link ${isActive(l.href) ? 'active' : ''}`}>
              {l.label}
            </Link>
          ))}

          <DropdownMenu title="Administration" links={ADMIN_LINKS} isActive={isActive('/admin')} />
          <DropdownMenu title="CRM" links={CRM_LINKS} isActive={isActive('/crm')} />
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <CartButton />
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            aria-label="Ouvrir le menu"
          >
            <i className="fa-solid fa-bars text-sm" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`mobile-menu lg:hidden ${mobileOpen ? 'open' : ''}`}
        id="mobile-menu"
        aria-hidden={!mobileOpen}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          aria-label="Fermer"
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
        {NAV_LINKS.map(l => (
          <Link key={l.href} href={l.href} className="mobile-link" onClick={() => setMobileOpen(false)}>{l.label}</Link>
        ))}
        {ADMIN_LINKS.map(l => (
          <Link key={l.href} href={l.href} className="mobile-link" onClick={() => setMobileOpen(false)}>Admin - {l.label}</Link>
        ))}
        {CRM_LINKS.map(l => (
          <Link key={l.href} href={l.href} className="mobile-link" onClick={() => setMobileOpen(false)}>CRM - {l.label}</Link>
        ))}
        <Link href="/panier" className="mobile-link" onClick={() => setMobileOpen(false)}>Panier</Link>
      </div>
    </nav>
  );
}

function DropdownMenu({ title, links, isActive }: { title: string; links: { href: string; label: string }[]; isActive: boolean }) {
  return (
    <div className="dropdown relative group">
      <span className={`nav-link ${isActive ? 'active' : ''} flex items-center`}>{title} <i className="fa-solid fa-chevron-down text-[0.6rem] ml-1" aria-hidden="true" /></span>
      <div className="dropdown-menu absolute left-0 top-full mt-2 w-48 flex flex-col bg-[color:var(--bg-surface)] border border-[color:var(--border)] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none group-hover:pointer-events-auto transition-all duration-200 z-50 p-2 gap-1">
        {links.map(l => (
          <Link key={l.href} href={l.href} className="dropdown-item flex items-center gap-2.5 px-3 py-2 text-sm text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-card-hover)] hover:text-[color:var(--primary-light)] rounded-lg transition-colors font-medium">
            <i className="fa-solid fa-chevron-right text-[0.65rem] opacity-70" aria-hidden="true" /> {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
