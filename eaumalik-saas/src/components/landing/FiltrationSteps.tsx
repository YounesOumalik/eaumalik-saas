'use client';

import { useEffect, useRef } from 'react';
import { Filter, FlaskConical, Atom, Droplets } from 'lucide-react';

const STEPS = [
  { icon: Filter, title: 'Sédiment PP 5µ', desc: 'Filtre les particules en suspension : rouille, sable, limon et autres impuretés visibles.' },
  { icon: FlaskConical, title: 'Charbon GAC', desc: 'Adsorbe le chlore, les odeurs et les goûts indésirables pour une eau neutre.' },
  { icon: Filter, title: 'Charbon CTO', desc: 'Affinage : élimine les résidus chimiques et améliore nettement le goût.' },
  { icon: Atom, title: 'Membrane OSMOSE', desc: 'Rejette jusqu’à 99% des sels, métaux lourds, bactéries et virus.' },
  { icon: Droplets, title: 'Post-filtre T33', desc: 'Polissage final : minéralisation et fraîcheur pour une eau pure et savoureuse.' },
];

export default function FiltrationSteps() {
  const sectionRef = useRef<HTMLElement>(null);
  const pipeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const steps = section.querySelectorAll<HTMLElement>('.artifact-step');
          steps.forEach((step, i) => {
            setTimeout(() => step.classList.add('visible'), i * 400);
          });
          pipeRef.current?.classList.add('flowing');
          observer.disconnect();
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="filtration" ref={sectionRef} className="py-24 surface-cream">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full pill-themed text-xs font-bold uppercase tracking-[0.3em] mb-4">
            <Droplets className="w-4 h-4" /> Technologie
          </div>
          <h2 className="font-serif text-4xl md:text-6xl mb-4 text-heading">Le Processus de Filtration</h2>
          <p className="max-w-2xl mx-auto text-body">
            Cinq étapes de purification pour une eau pure, saine et savoureuse à chaque goutte.
          </p>
        </div>

        <div className="relative">
          <div ref={pipeRef} className="artifact-pipe" aria-hidden="true">
            <div className="artifact-flow" />
            <div className="artifact-particle" />
            <div className="artifact-particle" />
            <div className="artifact-particle" />
          </div>

          <div className="pl-20 space-y-8">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="artifact-step relative">
                  <div className="artifact-node absolute -left-[4.625rem] top-0">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="artifact-card">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full pill-themed">
                        Étape {i + 1}
                      </span>
                      <h3 className="font-serif text-xl text-heading">{step.title}</h3>
                    </div>
                    <p className="leading-relaxed text-body">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
