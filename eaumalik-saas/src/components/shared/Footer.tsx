import Link from 'next/link';
import { Droplets } from 'lucide-react';
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
    <footer className="bg-stone-900 text-stone-300 rounded-t-[3rem] pt-16 pb-8 px-6 mt-12 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Bloc marque */}
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-4 group" aria-label="EauMalik">
              <span className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-105">
                <Droplets className="w-5 h-5" />
              </span>
              <span className="font-serif text-2xl font-bold text-white tracking-tight">
                Eau<span className="text-brand-400">Malik</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed mb-5 text-stone-400">
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
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-sm bg-stone-800 text-stone-300 hover:bg-brand-600 hover:text-white transition-all"
                >
                  <i className={`fa-brands ${s.icon}`} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Produits */}
          <div>
            <h4 className="font-serif font-bold text-sm mb-4 uppercase tracking-wider text-white">Produits</h4>
            <ul className="space-y-2.5 text-sm text-stone-400">
              {produits.map(p => (
                <li key={p.label}>
                  <Link href={p.href} className="hover:text-brand-400 transition-colors inline-flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-brand-500 transition-all group-hover:w-3" />
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-serif font-bold text-sm mb-4 uppercase tracking-wider text-white">Services</h4>
            <ul className="space-y-2.5 text-sm text-stone-400">
              {services.map(s => (
                <li key={s.label}>
                  <Link href={s.href} className="hover:text-brand-400 transition-colors inline-flex items-center gap-2 group">
                    <span className="w-1 h-1 rounded-full bg-brand-500 transition-all group-hover:w-3" />
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Suivez-nous / Contact */}
          <div>
            <h4 className="font-serif font-bold text-sm mb-4 uppercase tracking-wider text-white">Suivez-nous</h4>
            <ul className="space-y-2.5 text-sm text-stone-400">
              <li className="flex items-center gap-2">
                <i className="fa-solid fa-phone text-brand-500" aria-hidden="true" />
                <span>{company.phone}</span>
              </li>
              <li className="flex items-center gap-2">
                <i className="fa-solid fa-envelope text-brand-500" aria-hidden="true" />
                <a href={`mailto:${company.email}`} className="hover:text-brand-400 transition-colors break-all">{company.email}</a>
              </li>
              <li className="flex items-center gap-2">
                <i className="fa-solid fa-location-dot text-brand-500" aria-hidden="true" />
                <span>{company.address}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 flex flex-wrap justify-between items-center gap-3 text-xs text-stone-500 border-t border-stone-800">
          <span>© {year} {company.legal_name}</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" aria-hidden="true" />
            L&apos;eau pure, notre engagement
          </span>
        </div>
      </div>
    </footer>
  );
}
