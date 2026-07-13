'use client';

import { useState } from 'react';

interface Sector {
  title: string;
  description: string;
  icon: string;
  color: 'brand' | 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';
  bullets: string[];
}

const SECTORS: Sector[] = [
  {
    title: 'Usines & Industrie',
    description: 'Systèmes de traitement d\'eau industriels pour la production, le refroidissement et les process manufacturiers.',
    icon: 'fa-solid fa-industry',
    color: 'brand',
    bullets: [
      'Osmose industrielle 400-10000 GPD',
      'Adoucisseurs d\'eau',
      'Systèmes de filtration UV',
      'Stations de pompage',
    ],
  },
  {
    title: 'Hôtellerie & Restauration',
    description: 'Solutions d\'eau potable pour hôtels, restaurants, cafés et espaces de restauration collective.',
    icon: 'fa-solid fa-bell-concierge',
    color: 'blue',
    bullets: [
      'Fontaines multi-robinets',
      'Systèmes sous évier groupe',
      'Distribution en ligne',
      'Contrat maintenance inclus',
    ],
  },
  {
    title: 'Santé & Cliniques',
    description: 'Eau ultrapure conforme aux normes médicales pour cliniques, laboratoires et établissements de santé.',
    icon: 'fa-solid fa-hospital',
    color: 'emerald',
    bullets: [
      'Osmose double passage',
      'Stérilisation UV médicale',
      'Eau déminéralisée',
      'Conformité OMS garantie',
    ],
  },
  {
    title: 'Éducation & Collectivités',
    description: 'Points d\'eau potable pour écoles, universités, administrations et espaces publics.',
    icon: 'fa-solid fa-school',
    color: 'amber',
    bullets: [
      'Fontaines murales anti-gaspillage',
      'Systèmes centralisés',
      'Robustesse élevée',
      'Installation clé en main',
    ],
  },
  {
    title: 'Agroalimentaire',
    description: 'Traitement d\'eau conforme aux normes HACCP pour l\'industrie alimentaire et les boissons.',
    icon: 'fa-solid fa-utensils',
    color: 'rose',
    bullets: [
      'Osmose haute capacité',
      'Filtration stérile',
      'Contrôle qualité intégré',
      'Certification alimentaire',
    ],
  },
  {
    title: 'Résidences & Copropriétés',
    description: 'Systèmes de filtration centralisés pour immeubles résidentiels et copropriétés.',
    icon: 'fa-solid fa-building',
    color: 'violet',
    bullets: [
      'Adoucisseur collectif',
      'Filtration sur réseau',
      'Points de distribution',
      'Service après-vente 24/7',
    ],
  },
];

const COLOR_MAP: Record<Sector['color'], { bg: string; text: string; border: string }> = {
  brand: { bg: 'bg-brand-600/20', text: 'text-brand-400', border: 'border-brand-500/30' },
  blue: { bg: 'bg-blue-600/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  emerald: { bg: 'bg-emerald-600/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  amber: { bg: 'bg-amber-600/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  rose: { bg: 'bg-rose-600/20', text: 'text-rose-400', border: 'border-rose-500/30' },
  violet: { bg: 'bg-violet-600/20', text: 'text-violet-400', border: 'border-violet-500/30' },
};

const TRUST_BADGES = [
  { icon: 'fa-solid fa-truck-fast', label: 'Livraison & Installation' },
  { icon: 'fa-solid fa-shield-check', label: 'Garantie 1 à 3 ans' },
  { icon: 'fa-solid fa-wrench', label: 'Maintenance incluse' },
  { icon: 'fa-solid fa-headset', label: 'Support technique 24/7' },
];

/**
 * Section industrielle — 6 secteurs avec cartes en verre dépoli
 * sur fond sombre, bouton "Demander un devis" qui ouvre le formulaire de contact.
 */
export default function BoutiqueIndustrial() {
  const [activeSector, setActiveSector] = useState<string | null>(null);

  const handleClick = (sector: string) => {
    setActiveSector(sector);
    // Émet un événement DOM pour ouvrir la modale de contact du parent
    window.dispatchEvent(new CustomEvent('boutique:open-quote', { detail: { sector } }));
  };

  return (
    <section
      id="industriel"
      className="py-32 px-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg,#1c1917 0%,#292524 100%)' }}
    >
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-brand-500 blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-blue-500 blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-20 reveal revealed">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand-400 mb-4 block">
            Solutions professionnelles
          </span>
          <h2 className="font-serif text-4xl md:text-6xl font-normal leading-[0.85] tracking-tighter text-white mb-6">
            Produits industriels<br />
            <em className="text-brand-400">à négocier</em>
          </h2>
          <p className="text-lg text-stone-400 font-light max-w-2xl mx-auto">
            Des solutions sur mesure pour les entreprises, hôtels, cliniques et collectivités.
            Chaque projet est étudié individuellement pour répondre à vos besoins spécifiques.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {SECTORS.map((sector, idx) => {
            const colors = COLOR_MAP[sector.color];
            return (
              <div
                key={sector.title}
                className="group p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-brand-500/30 transition-all duration-500"
              >
                <div
                  className={`w-16 h-16 rounded-2xl ${colors.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
                >
                  <i className={`${sector.icon} text-3xl ${colors.text}`} aria-hidden="true" />
                </div>
                <h3 className="font-serif text-2xl text-white font-semibold mb-3">{sector.title}</h3>
                <p className="text-stone-400 text-sm leading-relaxed mb-6">{sector.description}</p>
                <ul className="space-y-2 mb-6">
                  {sector.bullets.map(b => (
                    <li key={b} className="flex items-center gap-2 text-stone-300 text-sm">
                      <i className={`fa-solid fa-circle-check ${colors.text}`} aria-hidden="true" />
                      {b}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => handleClick(sector.title)}
                  data-sector-idx={idx}
                  className={`w-full py-3 rounded-xl border ${colors.border} ${colors.text} text-sm font-bold uppercase tracking-wider hover:bg-white hover:text-stone-900 transition-all duration-300`}
                >
                  Demander un devis
                </button>
              </div>
            );
          })}
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-8 reveal revealed">
          {TRUST_BADGES.map(badge => (
            <div key={badge.label} className="flex items-center gap-3 text-stone-400">
              <i className={`${badge.icon} text-2xl text-brand-500`} aria-hidden="true" />
              <span className="text-sm font-medium">{badge.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}