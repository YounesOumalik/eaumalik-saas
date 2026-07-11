import Link from 'next/link';
import Image from 'next/image';
import { getCompanyProfile } from '@/data/repositories';

export default async function Footer() {
  const company = await getCompanyProfile();
  const year = new Date().getFullYear();

  return (
    <footer className="py-16 px-4" style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
      <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center mb-4">
            <div className="h-10 w-32 sm:w-40 relative">
              <Image src="/logo.png" alt="EAUMALIK Logo" fill className="object-contain object-left" unoptimized />
            </div>
          </div>
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
            Captage, traitement et distribution d&apos;eau. L&apos;eau pure, une vie plus saine.
          </p>
          <div className="flex gap-3">
            {['facebook-f', 'instagram', 'whatsapp'].map(icon => (
              <a
                key={icon}
                href="#"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm hover:scale-110 transition-transform"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                aria-label={icon}
              >
                <i className={`fa-brands fa-${icon}`} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-display font-bold text-sm mb-4" style={{ color: 'var(--text)' }}>Navigation</h4>
          <ul className="space-y-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            <li><Link href="/" className="hover:text-primary-400 transition-colors">Accueil</Link></li>
            <li><Link href="/boutique" className="hover:text-primary-400 transition-colors">Boutique</Link></li>
            <li><Link href="/panier" className="hover:text-primary-400 transition-colors">Panier</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-bold text-sm mb-4" style={{ color: 'var(--text)' }}>Nos Services</h4>
          <ul className="space-y-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            <li>Purificateurs d&apos;eau</li>
            <li>Osmose inverse</li>
            <li>Stations industrielles</li>
            <li>Maintenance et filtres</li>
            <li>Installation professionnelle</li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-bold text-sm mb-4" style={{ color: 'var(--text)' }}>Contact</h4>
          <ul className="space-y-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            <li className="flex items-start gap-2">
              <i className="fa-solid fa-location-dot mt-1" style={{ color: 'var(--primary)' }} aria-hidden="true" />
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
              <i className="fa-solid fa-envelope" style={{ color: 'var(--primary)' }} aria-hidden="true" />
              <a href={`mailto:${company.email}`}>{company.email}</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-12 pt-8 flex flex-wrap justify-between items-center gap-4 text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
        <span>{year} {company.legal_name}. Capital : {company.capital.toLocaleString('fr-MA')} MAD. Tous droits reserves.</span>
        <span>RCS Casablanca — IF / Taxe : conforme</span>
      </div>
    </footer>
  );
}
