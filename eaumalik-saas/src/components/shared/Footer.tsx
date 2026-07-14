import Link from 'next/link';
import { Droplets } from 'lucide-react';
import BrandLogo from './BrandLogo';
import { getCompanyProfile } from '@/data/repositories';

export default async function Footer() {
  const company = await getCompanyProfile();
  const year = new Date().getFullYear();

  const produits = [
    { href: '/boutique', label: 'Tout le catalogue' },
    { href: '/#catalogue', label: 'Purificateurs' },
    { href: '/#catalogue', label: 'Osmoseurs' },
    { href: '/#catalogue', label: 'Fontaines' },
    { href: '/#catalogue', label: 'Consommables' },
  ];

  const services = [
    { href: '/#industriel', label: 'Solutions professionnelles' },
    { href: '/#industriel', label: 'Installation & maintenance' },
    { href: '/#contact', label: 'Devis sur mesure' },
    { href: '/#contact', label: 'Support & livraison' },
  ];

  const socials = [
    { icon: 'fa-facebook-f', label: 'Facebook', href: '#' },
    { icon: 'fa-instagram', label: 'Instagram', href: '#' },
    { icon: 'fa-whatsapp', label: 'WhatsApp', href: 'https://wa.me/212600000000' },
  ];

  return (
    <footer
      className="footer-surface rounded-t-[3rem] pt-16 pb-8 px-6 mt-12 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Bloc marque */}
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-4 group" aria-label="EauMalik">
              <BrandLogo size="md" tone="dark" className="group-hover:opacity-90 transition-opacity" />
            </Link>
            <p className="text-sm leading-relaxed mb-5 footer-muted">
              L&apos;eau pure, notre engagement. Captage, traitement et distribution d&apos;eau pour les foyers et les professionnels.
            </p>
            <div className="flex gap-2.5">
              {socials.map(s => (
                <a
                  key={s.icon}
                  href={s.href}
                  target={s.href.startsWith('http') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm border-soft transition-all"
                  style={{ background: 'var(--bg-card)', color: 'var(--footer-muted)' }}
                >
                  <i className={`fa-brands ${s.icon}`} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Produits */}
          <div>
            <h4 className="font-serif font-bold text-sm mb-4 uppercase tracking-wider text-heading">Produits</h4>
            <ul className="space-y-2.5 text-sm footer-muted">
              {produits.map(p => (
                <li key={p.label}>
                  <Link href={p.href} className="hover:opacity-80 transition-colors inline-flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full transition-all group-hover:w-3" style={{ background: 'var(--primary)' }} />
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-serif font-bold text-sm mb-4 uppercase tracking-wider text-heading">Services</h4>
            <ul className="space-y-2.5 text-sm footer-muted">
              {services.map(s => (
                <li key={s.label}>
                  <Link href={s.href} className="hover:opacity-80 transition-colors inline-flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full transition-all group-hover:w-3" style={{ background: 'var(--primary)' }} />
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Suivez-nous / Contact */}
          <div>
            <h4 className="font-serif font-bold text-sm mb-4 uppercase tracking-wider text-heading">Suivez-nous</h4>
            <ul className="space-y-2.5 text-sm footer-muted">
              <li className="flex items-center gap-2">
                <i className="fa-solid fa-phone" aria-hidden="true" style={{ color: 'var(--primary)' }} />
                <span>{company.phone}</span>
              </li>
              <li className="flex items-center gap-2">
                <i className="fa-solid fa-envelope" aria-hidden="true" style={{ color: 'var(--primary)' }} />
                <a href={`mailto:${company.email}`} className="hover:opacity-80 transition-colors break-all">{company.email}</a>
              </li>
              <li className="flex items-center gap-2">
                <i className="fa-solid fa-location-dot" aria-hidden="true" style={{ color: 'var(--primary)' }} />
                <span>{company.address}</span>
              </li>
            </ul>
          </div>
        </div>

        <div
          className="mt-12 pt-6 flex flex-wrap justify-between items-center gap-3 text-xs border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <span>© {year} {company.legal_name}</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" aria-hidden="true" style={{ background: 'var(--primary)' }} />
            L&apos;eau pure, notre engagement
          </span>
        </div>
      </div>
    </footer>
  );
}
