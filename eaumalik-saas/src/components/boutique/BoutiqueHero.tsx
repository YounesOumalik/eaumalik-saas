'use client';

import { useTheme } from '@/components/shared/ThemeProvider';
import { useEffect, useState } from 'react';

const NAV_LINKS = [
  { href: '#accueil', label: 'Accueil' },
  { href: '#filtration', label: 'Filtration' },
  { href: '#catalogue', label: 'Catalogue' },
  { href: '#industriel', label: 'Industriel' },
  { href: '#contact', label: 'Contact' },
];

/**
 * Hero du nouveau design boutique — typographie serif + degradé teal
 * adapte au theme courant, particules d'eau animees, CTA doubles
 * et barre de defilement.
 */
export default function BoutiqueHero() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted ? theme === 'dark' : true;

  return (
    <section id="accueil" className="relative">
      {/* HERO */}
      <section
        className="relative flex items-center justify-center overflow-hidden rounded-b-[3rem] py-16 md:py-20"
        style={
          isDark
            ? { background: 'linear-gradient(135deg,#0c4a6e 0%,#082f49 50%,#020617 100%)' }
            : { background: 'linear-gradient(135deg,#0284c7 0%,#0ea5e9 50%,#7dd3fc 100%)' }
        }
      >
        {/* Halos decoratifs */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-ocean-400 blur-[100px]" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-blue-400 blur-[120px]" />
        </div>

        {/* Particules d'eau flottantes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[0, 0.5, 1, 1.5, 0.8].map((delay, idx) => (
            <div
              key={idx}
              className="absolute rounded-full animate-water-drop"
              style={{
                top: `${15 + idx * 10}%`,
                left: `${20 + idx * 12}%`,
                width: `${6 + idx * 2}px`,
                height: `${6 + idx * 2}px`,
                background: idx % 2 === 0 ? 'rgba(94,234,212,0.5)' : 'rgba(125,211,252,0.4)',
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center px-6 max-w-5xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-ocean-200 text-xs font-bold uppercase tracking-[0.3em] mb-5">
            <i className="fa-solid fa-shield-halved" aria-hidden="true" />
            L&apos;eau pure, notre engagement
          </div>
          <h1 className="font-serif text-4xl md:text-7xl font-normal text-white leading-[0.9] tracking-tighter mb-6">
            Catalogue
            <br />
            <em className="text-ocean-300">Produits</em>
          </h1>
          <p className="text-base md:text-lg text-white/80 font-light max-w-2xl mx-auto mb-8 leading-relaxed">
            Découvrez notre gamme complète de systèmes de filtration, fontaines et consommables
            pour une eau pure et saine.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#catalogue"
              className="px-8 py-4 rounded-2xl text-sm font-bold uppercase tracking-wide transition-all duration-300 hover:scale-105 bg-white"
              style={{
                color: '#0369a1',
                boxShadow: '0 8px 32px rgba(255,255,255,0.25)',
              }}
            >
              Voir le catalogue
            </a>
            <a
              href="#filtration"
              className="px-8 py-4 rounded-2xl text-sm font-bold uppercase tracking-wide transition-all duration-300 border border-white/30 text-white hover:bg-white/10"
            >
              Comment ça marche
            </a>
          </div>
        </div>

        {/* Indicateur de defilement */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="w-6 h-10 rounded-full border-2 border-white/30 flex justify-center pt-2">
            <div className="w-1 h-2 rounded-full bg-white/60 animate-bounce" />
          </div>
        </div>
      </section>
    </section>
  );
}