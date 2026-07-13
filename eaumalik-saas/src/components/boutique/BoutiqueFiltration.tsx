'use client';

import { useEffect, useRef, useState } from 'react';

interface Step {
  num: string;
  title: string;
  description: string;
  gradient: string;
  border: string;
  icon: string;
  pillBg: string;
  pillText: string;
  glow?: boolean;
  doneIcon?: boolean;
}

const STEPS: Step[] = [
  {
    num: 'Étape 01',
    title: 'Sédiment PP',
    description: 'Élimine les particules en suspension, sable, rouille et sédiments jusqu\'à 5 microns',
    gradient: 'from-amber-100 to-amber-50',
    border: 'border-amber-200/50',
    icon: 'fa-solid fa-filter',
    pillBg: 'bg-amber-100',
    pillText: 'text-amber-700',
  },
  {
    num: 'Étape 02',
    title: 'Charbon GAC',
    description: 'Charbon actif granulé qui absorbe le chlore, les pesticides et les composés organiques',
    gradient: 'from-stone-800 to-stone-700',
    border: 'border-stone-600/50',
    icon: 'fa-solid fa-cubes-stacked',
    pillBg: 'bg-stone-200',
    pillText: 'text-stone-700',
  },
  {
    num: 'Étape 03',
    title: 'Charbon CTO',
    description: 'Bloc de charbon actif compressé pour une filtration fine du chlore résiduel et des odeurs',
    gradient: 'from-stone-700 to-stone-600',
    border: 'border-stone-500/50',
    icon: 'fa-solid fa-filter-circle-xmark',
    pillBg: 'bg-stone-200',
    pillText: 'text-stone-700',
  },
  {
    num: 'Étape 04',
    title: 'Membrane RO',
    description: 'Osmose inverse 100 GPD, élimine 99% des bactéries, virus, métaux lourds et nitrates',
    gradient: 'from-brand-600 to-brand-700',
    border: 'border-brand-500/50',
    icon: 'fa-solid fa-atom',
    pillBg: 'bg-brand-100',
    pillText: 'text-brand-700',
    glow: true,
  },
  {
    num: 'Étape 05',
    title: 'Post-filtre T33',
    description: 'Filtre final au charbon actif qui améliore le goût et équilibre le pH de l\'eau pure',
    gradient: 'from-cyan-100 to-blue-50',
    border: 'border-cyan-200/50',
    icon: 'fa-solid fa-circle-check',
    pillBg: 'bg-cyan-100',
    pillText: 'text-cyan-700',
    doneIcon: true,
  },
];

/**
 * Section "5 étapes vers l'eau pure" — animation séquentielle au scroll
 * avec barre de progression et particules.
 */
export default function BoutiqueFiltration() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          STEPS.forEach((_, i) => {
            setTimeout(() => setVisibleCount(c => Math.max(c, i + 1)), i * 400);
          });
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="filtration" className="py-32 px-6 bg-stone-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-20 reveal revealed">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand-600 mb-4 block">
            Processus de filtration
          </span>
          <h2 className="font-serif text-4xl md:text-6xl font-normal leading-[0.85] tracking-tighter mb-6 text-stone-900">
            5 étapes vers<br />
            <em className="text-brand-700">l&apos;eau pure</em>
          </h2>
          <p className="text-lg text-stone-500 font-light max-w-xl mx-auto">
            Notre système d&apos;osmose inverse élimine jusqu&apos;à 99% des impuretés
            en 5 étapes successives.
          </p>
        </div>

        <div ref={containerRef} className="relative max-w-[900px] mx-auto">
          <div className="relative grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-4">
            {STEPS.map((step, idx) => (
              <div
                key={step.title}
                className={`boutique-step flex flex-col items-center text-center ${
                  idx < visibleCount ? 'visible' : ''
                }`}
              >
                <div
                  className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br ${step.gradient} border ${step.border} flex items-center justify-center mb-4 relative overflow-hidden ${
                    step.glow ? 'animate-pulse-glow' : ''
                  }`}
                >
                  <div
                    className="absolute inset-0 rounded-2xl animate-shimmer"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                      backgroundSize: '200% 100%',
                      animationDelay: `${(idx + 1) * 0.5}s`,
                    }}
                  />
                  <i
                    className={`${step.icon} text-4xl md:text-5xl relative z-10 ${
                      idx <= 2 ? 'text-white' : idx === 3 ? 'text-white' : 'text-cyan-600'
                    }`}
                    aria-hidden="true"
                  />
                </div>
                <span className={`inline-block px-3 py-1 rounded-full ${step.pillBg} ${step.pillText} text-[10px] font-bold uppercase tracking-widest mb-2`}>
                  {step.num}
                </span>
                <h3 className="font-serif text-lg font-semibold mb-2 text-stone-900">
                  {step.title}
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">{step.description}</p>
                <div className="mt-3 flex items-center gap-1">
                  {[0, 0.3, 0.6].map(d => (
                    <span
                      key={d}
                      className={`w-1.5 h-1.5 rounded-full animate-flow-down ${
                        step.glow ? 'bg-brand-300' : 'bg-brand-500'
                      }`}
                      style={{ animationDelay: `${d}s` }}
                    />
                  ))}
                  {step.doneIcon && (
                    <>
                      <i className="fa-solid fa-circle-check text-lg text-cyan-500 ml-1" aria-hidden="true" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600">
                        Eau pure
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Barre de progression */}
          <div className="relative mt-12 mx-4 md:mx-0">
            <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-brand-500 to-cyan-400 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${(visibleCount / STEPS.length) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-stone-400 font-medium uppercase tracking-wider">
              <span>Eau brute</span>
              <span>Eau purifiée</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}