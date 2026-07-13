import Link from 'next/link';
import { getCompanyProfile } from '@/data/repositories';

export default async function Footer() {
  const company = await getCompanyProfile();
  const year = new Date().getFullYear();

  const navLinks = [
    { href: '/',          label: 'Accueil' },
    { href: '/boutique',  label: 'Boutique' },
    { href: '/panier',    label: 'Panier' },
    { href: '/login',     label: 'Connexion' },
  ];

  const services = [
    'Purificateurs d&apos;eau',
    'Osmose inverse',
    'Stations industrielles',
    'Maintenance et filtres',
    'Installation professionnelle',
  ];

  const socials = [
    { icon: 'fa-facebook-f',  label: 'Facebook' },
    { icon: 'fa-instagram',   label: 'Instagram' },
    { icon: 'fa-whatsapp',    label: 'WhatsApp' },
  ];

  return (
    <footer
      className="relative pt-16 pb-8 px-4 mt-12 overflow-hidden"
      style={{
        background: 'var(--bg)',
        borderTop: '1px solid var(--border)',
      }}
    >
      {/* Halo teal décoratif */}
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[80vw] h-64 rounded-full opacity-20 blur-[120px] pointer-events-none"
        style={{ background: 'var(--primary)' }}
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto relative">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Bloc marque */}
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-4 group" aria-label="EAUMALIK">
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-105"
                style={{ background: 'linear-gradient(135deg, var(--brand-500), var(--brand-700))' }}
              >
                <i className="fa-solid fa-droplet text-lg" aria-hidden="true" />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-display font-extrabold text-lg tracking-tight gradient-text">
                  EAUMALIK
                </span>
                <span
                  className="text-[0.65rem] font-medium uppercase tracking-[0.18em]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  L&apos;eau pure
                </span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>
              Captage, traitement et distribution d&apos;eau. L&apos;eau pure, une vie plus saine.
            </p>
            <div className="flex gap-2.5">
              {socials.map(s => (
                <a
                  key={s.icon}
                  href="#"
                  aria-label={s.label}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all hover:scale-110 hover:text-white"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <i className={`fa-brands ${s.icon}`} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4
              className="font-display font-bold text-sm mb-4 uppercase tracking-wider"
              style={{ color: 'var(--text)' }}
            >
              Navigation
            </h4>
            <ul className="space-y-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>
              {navLinks.map(l => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="hover:text-[color:var(--primary-light)] transition-colors inline-flex items-center gap-2 group"
                  >
                    <span
                      className="w-1 h-1 rounded-full transition-all group-hover:w-3"
                      style={{ background: 'var(--primary)' }}
                    />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4
              className="font-display font-bold text-sm mb-4 uppercase tracking-wider"
              style={{ color: 'var(--text)' }}
            >
              Nos Services
            </h4>
            <ul className="space-y-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>
              {services.map(s => (
                <li key={s} className="flex items-center gap-2">
                  <i
                    className="fa-solid fa-check text-[0.65rem]"
                    style={{ color: 'var(--primary)' }}
                    aria-hidden="true"
                  />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4
              className="font-display font-bold text-sm mb-4 uppercase tracking-wider"
              style={{ color: 'var(--text)' }}
            >
              Contact
            </h4>
            <ul className="space-y-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>
              <li className="flex items-start gap-2">
                <i
                  className="fa-solid fa-location-dot mt-1"
                  style={{ color: 'var(--primary)' }}
                  aria-hidden="true"
                />
                <span>{company.address}</span>
              </li>
              <li className="flex items-center gap-2">
                <i className="fa-solid fa-phone" style={{ color: 'var(--primary)' }} aria-hidden="true" />
                <span>{company.phone}</span>
              </li>
              <li className="flex items-center gap-2">
                <i className="fa-solid fa-phone" style={{ color: 'var(--primary)' }} aria-hidden="true" />
                <span>066 072 07 59</span>
              </li>
              <li className="flex items-center gap-2">
                <i
                  className="fa-solid fa-envelope"
                  style={{ color: 'var(--primary)' }}
                  aria-hidden="true"
                />
                <a
                  href={`mailto:${company.email}`}
                  className="hover:text-[color:var(--primary-light)] transition-colors break-all"
                >
                  {company.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div
          className="mt-12 pt-6 flex flex-wrap justify-between items-center gap-3 text-xs"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}
        >
          <span>
            © {year} {company.legal_name} · Capital {company.capital.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--primary)' }}
              aria-hidden="true"
            />
            RCS Casablanca — IF / Taxe : conforme
          </span>
        </div>
      </div>
    </footer>
  );
}