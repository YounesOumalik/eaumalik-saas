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
    description: "Élimine les particules en suspension, sable, rouille et sédiments jusqu'à 5 microns",
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
    gradient: 'from-ocean-600 to-ocean-700',
    border: 'border-ocean-500/50',
    icon: 'fa-solid fa-atom',
    pillBg: 'bg-ocean-100',
    pillText: 'text-ocean-700',
    glow: true,
  },
  {
    num: 'Étape 05',
    title: 'Post-filtre T33',
    description: "Filtre final au charbon actif qui améliore le goût et équilibre le pH de l'eau pure",
    gradient: 'from-cyan-100 to-blue-50',
    border: 'border-cyan-200/50',
    icon: 'fa-solid fa-circle-check',
    pillBg: 'bg-cyan-100',
    pillText: 'text-cyan-700',
    doneIcon: true,
  },
];

/**
 * Section "Comment fonctionne l'osmose inverse ?" — diagramme animé horizontal
 * + 5 étapes détaillées. Le schéma se déclenche au scroll : la pompe tourne,
 * les impuretés flottent dans le flux d'entrée, la membrane pulse et rejette
 * les contaminants, l'eau pure descend dans le verre et le niveau monte.
 *
 * Déplacée depuis /boutique vers la page d'accueil le 2026-07-14 pour
 * mettre en avant le fonctionnement de la filtration sur le hero flow.
 */
export default function FiltrationSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [diagramActive, setDiagramActive] = useState(false);

  // Reveal séquentiel des 5 étapes
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

  // Active le diagramme RO quand il entre dans le viewport
  useEffect(() => {
    const node = diagramRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setDiagramActive(true);
          obs.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="filtration" className="py-24 md:py-32 px-4 md:px-6 surface-savor overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* === HEADER === */}
        <div className="text-center mb-16 reveal revealed">
          <span
            className="text-xs font-bold uppercase tracking-[0.3em] mb-4 block"
            style={{ color: 'var(--primary)' }}
          >
            Processus de filtration
          </span>
          <h2 className="font-serif text-4xl md:text-6xl font-normal leading-[0.85] tracking-tighter mb-6 text-heading">
            Comment fonctionne<br />
            <em style={{ color: 'var(--primary)' }}>l&apos;osmose inverse&nbsp;?</em>
          </h2>
          <p className="text-lg font-light max-w-2xl mx-auto text-body leading-relaxed">
            L&apos;eau du robinet est poussée sous pression à travers une membrane semi-perméable :
            les molécules d&apos;H<sub>2</sub>O traversent, les contaminants sont rejetés.
          </p>
        </div>

        {/* === DIAGRAMME RO ANIME === */}
        <div
          ref={diagramRef}
          className={`ro-diagram-shell relative p-6 md:p-10 mb-20 transition-opacity duration-700 ${
            diagramActive ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Pastilles décoratives */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2rem]">
            {[0, 0.7, 1.4, 2.1].map((d, i) => (
              <span
                key={i}
                className="ro-float-dot absolute w-1.5 h-1.5 rounded-full"
                style={{
                  top: `${15 + i * 18}%`,
                  left: `${8 + i * 22}%`,
                  background: i % 2 ? 'var(--ocean-300)' : 'var(--ocean-400)',
                  animationDelay: `${d}s`,
                  opacity: 0.5,
                }}
              />
            ))}
          </div>

          {/* LABEL DIAGRAMME */}
          <div className="flex items-center justify-between mb-6 relative z-10 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.25em]"
                style={{
                  background: 'var(--primary-glow)',
                  color: 'var(--primary-light)',
                  border: '1px solid var(--border)',
                }}
              >
                <i className="fa-solid fa-circle-play text-[10px]" aria-hidden="true" />
                Schéma animé
              </span>
              <span className="text-[11px] uppercase tracking-wider text-meta">
                Osmose inverse — 5 étapes
              </span>
            </div>
            <div className="hidden md:flex items-center gap-3 text-[10px] uppercase tracking-wider text-meta">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Impuretés
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-ocean-500" />
                Eau brute
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Eau pure
              </span>
            </div>
          </div>

          {/* === PIPELINE HORIZONTAL === */}
          <div className="relative z-10">
            {/* Lignes de flux (3D pipes) — desktop */}
            <div className="hidden md:block">
              {/* Pipe entrée : Eau brute -> Membrane */}
              <div
                className="absolute top-1/2 left-[14%] right-[58%] h-3 -translate-y-1/2 rounded-full overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, var(--ocean-700), var(--ocean-500))',
                  border: '1px solid var(--border)',
                }}
                aria-hidden="true"
              >
                <div className="ro-pipe absolute inset-0" />
              </div>
              {/* Pipe sortie : Eau pure -> Verre (vers le bas) */}
              <div
                className="absolute top-1/2 right-[12%] w-3 h-24 -translate-y-1/2 rounded-full overflow-hidden"
                style={{
                  background: 'linear-gradient(90deg, var(--ocean-500), var(--ocean-700))',
                  border: '1px solid var(--border)',
                }}
                aria-hidden="true"
              >
                <div className="ro-pipe--pure absolute inset-0" />
              </div>
              {/* Pipe rejet : vers le haut-droite */}
              <div
                className="absolute top-[28%] right-[20%] w-3 h-16 -translate-y-1/2 rounded-full overflow-hidden rotate-45"
                style={{
                  background: 'linear-gradient(90deg, #d97706, #fbbf24)',
                  border: '1px solid var(--border)',
                }}
                aria-hidden="true"
              >
                <div className="ro-pipe--reject absolute inset-0" />
              </div>
            </div>

            {/* === BLOCS === */}
            <div className="grid grid-cols-2 md:grid-cols-[1fr_auto_1.3fr_auto_1fr] gap-6 md:gap-4 items-center relative">
              {/* 1. EAU BRUTE (robinet) */}
              <div className="text-center">
                <div
                  className="mx-auto mb-3 w-20 h-20 rounded-2xl flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, var(--ocean-700), var(--ocean-500))',
                    border: '1px solid var(--border)',
                    boxShadow: '0 8px 24px rgba(14,165,233,0.25)',
                  }}
                >
                  <i className="fa-solid fa-faucet text-3xl text-white relative z-10" aria-hidden="true" />
                  {/* Impuretés flottantes */}
                  {diagramActive && [0, 0.8, 1.6, 2.4].map((d, i) => (
                    <span
                      key={i}
                      className="ro-impurity absolute w-1.5 h-1.5 rounded-full bg-amber-700"
                      style={{
                        top: `${25 + (i % 2) * 30}%`,
                        left: '20%',
                        ['--drift' as string]: `${i % 2 ? -8 : 8}px`,
                        animationDelay: `${d}s`,
                      }}
                    />
                  ))}
                </div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-meta mb-1">
                  Eau brute
                </p>
                <p className="text-xs text-body leading-snug">
                  Pression atmosphérique<br />
                  <span className="text-[10px] text-meta">TDS&nbsp;≈&nbsp;300-800&nbsp;ppm</span>
                </p>
              </div>

              {/* 2. POMPE HP + MANOMETRE */}
              <div className="text-center">
                <div className="relative mx-auto mb-3 w-20 h-20">
                  {/* Boîtier pompe */}
                  <div
                    className="absolute inset-0 rounded-2xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #475569, #1e293b)',
                      border: '1px solid var(--border)',
                      boxShadow: '0 8px 24px rgba(15,23,42,0.4)',
                    }}
                  >
                    {/* Rotor */}
                    <div
                      className={`ro-pump-rotor relative w-12 h-12 rounded-full ${
                        diagramActive ? '' : '[animation-play-state:paused]'
                      }`}
                      style={{
                        background: 'conic-gradient(from 0deg, var(--ocean-400), var(--ocean-600), var(--ocean-400))',
                      }}
                    >
                      <span className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white" />
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white" />
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white" />
                      <span className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                    <i
                      className="fa-solid fa-gauge-high absolute -bottom-1 -right-1 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--ocean-500)' }}
                      aria-hidden="true"
                    />
                  </div>
                </div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-meta mb-1">
                  Pompe HP
                </p>
                <p className="text-xs text-body leading-snug">
                  <span className="font-mono font-bold" style={{ color: 'var(--primary-light)' }}>
                    2 – 17 bar
                  </span>
                  <br />
                  <span className="text-[10px] text-meta">Pression osmotique vaincue</span>
                </p>
              </div>

              {/* 3. MEMBRANE RO */}
              <div className="text-center">
                <div
                  className="ro-membrane relative mx-auto mb-3 w-28 h-28 rounded-2xl flex items-center justify-center overflow-hidden"
                  style={{
                    background:
                      'linear-gradient(180deg, var(--ocean-700) 0%, var(--ocean-500) 50%, var(--ocean-300) 100%)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {/* Pores stripes */}
                  <div className="ro-membrane-stripes absolute inset-0 opacity-60" aria-hidden="true" />
                  {/* Permeat (gouttes qui descendent) */}
                  {diagramActive && [0, 0.35, 0.7, 1.05].map((d, i) => (
                    <span
                      key={`p-${i}`}
                      className="ro-permeate absolute left-1/2 -translate-x-1/2 w-1.5 h-2 rounded-full"
                      style={{
                        top: '40%',
                        background: 'rgba(165,243,252,0.95)',
                        boxShadow: '0 0 6px rgba(165,243,252,0.8)',
                        animationDelay: `${d}s`,
                      }}
                    />
                  ))}
                  {/* Contaminants rejetés (rebondissent et sortent à droite) */}
                  {diagramActive && [0.4, 1.2, 2.0, 2.8].map((d, i) => (
                    <span
                      key={`r-${i}`}
                      className="ro-rejected absolute w-1.5 h-1.5 rounded-full"
                      style={{
                        top: `${30 + (i % 2) * 25}%`,
                        left: `${30 + (i % 2) * 10}%`,
                        background: i % 2 ? '#d97706' : '#a16207',
                        animationDelay: `${d}s`,
                      }}
                    />
                  ))}
                  <div className="relative z-10 text-center">
                    <i className="fa-solid fa-atom text-3xl text-white" aria-hidden="true" />
                    <div className="text-[8px] font-bold tracking-widest text-white/90 uppercase mt-1">
                      0.0001&nbsp;µm
                    </div>
                  </div>
                </div>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--primary-light)' }}>
                  Membrane RO
                </p>
                <p className="text-xs text-body leading-snug">
                  Semi-perméable<br />
                  <span className="text-[10px] text-meta">Rejette 99% des solutés</span>
                </p>
              </div>

              {/* 4. SORTIE EAU PURE (verre) */}
              <div className="text-center">
                <div className="relative mx-auto mb-3 w-20 h-24">
                  {/* Verre */}
                  <div
                    className="absolute inset-x-2 top-2 bottom-2 rounded-b-2xl overflow-hidden"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '2px solid var(--border)',
                      borderTop: 'none',
                    }}
                  >
                    {/* Eau qui remplit */}
                    <div
                      className="ro-glass-fill absolute inset-x-0 bottom-0"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(125,211,252,0.85) 0%, rgba(14,165,233,0.95) 100%)',
                        borderTop: '1px solid rgba(255,255,255,0.4)',
                      }}
                    >
                      {/* Vagues */}
                      <svg
                        viewBox="0 0 60 8"
                        preserveAspectRatio="none"
                        className="absolute -top-2 left-0 w-full h-2"
                        aria-hidden="true"
                      >
                        <path
                          d="M0,4 Q15,0 30,4 T60,4 V8 H0 Z"
                          fill="rgba(125,211,252,0.85)"
                        />
                      </svg>
                    </div>
                    {/* Bulles */}
                    {diagramActive && [0, 0.6, 1.2, 1.8].map((d, i) => (
                      <span
                        key={`b-${i}`}
                        className="ro-bubble absolute w-1 h-1 rounded-full bg-cyan-100/80"
                        style={{
                          left: `${20 + i * 15}%`,
                          bottom: '20%',
                          animationDelay: `${d}s`,
                        }}
                      />
                    ))}
                  </div>
                  <i
                    className="fa-solid fa-glass-water absolute -top-1 left-1/2 -translate-x-1/2 text-cyan-400 text-xs"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--ocean-400)' }}>
                  Eau pure
                </p>
                <p className="text-xs text-body leading-snug">
                  Perméat<br />
                  <span className="text-[10px] text-meta">TDS&nbsp;≈&nbsp;10-50&nbsp;ppm</span>
                </p>
              </div>
            </div>

            {/* === INDICATEURS SECONDAIRES === */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-10 relative z-10">
              {[
                { icon: 'fa-solid fa-bacteria', label: 'Bactéries', value: '99.99 %' },
                { icon: 'fa-solid fa-flask', label: 'Métaux lourds', value: '99 %' },
                { icon: 'fa-solid fa-leaf', label: 'Sans chimie', value: '100 %' },
                { icon: 'fa-solid fa-bolt', label: 'Récup. énergie', value: '60 %' },
              ].map(stat => (
                <div
                  key={stat.label}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <i
                    className={`${stat.icon} text-lg`}
                    style={{ color: 'var(--primary-light)' }}
                    aria-hidden="true"
                  />
                  <div className="text-left">
                    <p className="text-[10px] uppercase tracking-wider text-meta leading-none mb-1">
                      {stat.label}
                    </p>
                    <p className="text-sm font-bold text-heading leading-none">
                      {stat.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* === JAUGE BAR (sous le diagramme) === */}
            <div className="relative mt-10 mx-2 md:mx-8">
              <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-meta mb-2">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Eau brute
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  Eau purifiée
                </span>
              </div>
              <div
                className="relative h-3 rounded-full overflow-hidden"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(217,119,6,0.25), rgba(56,189,248,0.25))',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, #d97706, var(--ocean-500), var(--ocean-300))',
                    width: diagramActive ? '100%' : '0%',
                    transition: 'width 2s cubic-bezier(0.16,1,0.3,1)',
                  }}
                />
              </div>
            </div>

            {/* === LEGENDE MOBILE === */}
            <div className="md:hidden flex flex-wrap items-center justify-center gap-3 text-[10px] uppercase tracking-wider text-meta mt-6">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Impuretés
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-ocean-500" /> Eau brute
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" /> Eau pure
              </span>
            </div>
          </div>
        </div>

        {/* === 5 ETAPES DETAILLEES === */}
        <div ref={containerRef} className="relative max-w-[1000px] mx-auto">
          <div className="text-center mb-10">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-meta block mb-2">
              Le parcours de l&apos;eau
            </span>
            <h3 className="font-serif text-2xl md:text-3xl text-heading">
              5 étapes vers <em style={{ color: 'var(--primary)' }}>l&apos;eau pure</em>
            </h3>
          </div>

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
                <h3 className="font-serif text-lg font-semibold mb-2 text-heading">
                  {step.title}
                </h3>
                <p className="text-xs leading-relaxed text-meta">{step.description}</p>
                <div className="mt-3 flex items-center gap-1">
                  {[0, 0.3, 0.6].map(d => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 rounded-full animate-flow-down"
                      style={{ background: 'var(--primary)', animationDelay: `${d}s` }}
                    />
                  ))}
                  {step.doneIcon && (
                    <>
                      <i className="fa-solid fa-circle-check text-lg ml-1" style={{ color: 'var(--ocean-400)' }} aria-hidden="true" />
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ocean-500)' }}>
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
            <div className="h-2 rounded-full overflow-hidden surface-solid">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  background: 'linear-gradient(90deg, var(--warning), var(--ocean-500), var(--ocean-300))',
                  width: `${(visibleCount / STEPS.length) * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[10px] font-medium uppercase tracking-wider text-meta">
              <span>Eau brute</span>
              <span>Eau purifiée</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
