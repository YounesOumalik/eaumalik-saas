'use client';

import { useEffect } from 'react';

const FEATURES = [
  { icon: 'fa-solid fa-award',       title: 'Expertise professionnelle',  desc: "Plusieurs annees d'experience dans le traitement et la purification de l'eau au Maroc." },
  { icon: 'fa-solid fa-shield-halved', title: 'Produits de qualite',        desc: 'Equipements certifies et testes pour garantir une performance optimale et une duree de vie maximale.' },
  { icon: 'fa-solid fa-droplet',     title: 'Eau pure et sure',           desc: "Elimination de jusqu'a 99% des impuretes, bacteries et contaminants pour une eau saine." },
  { icon: 'fa-solid fa-wrench',      title: 'Installation professionnelle', desc: 'Nos techniciens qualifies assurent une installation rapide et conforme aux normes.' },
  { icon: 'fa-solid fa-headset',     title: 'Service apres-vente',        desc: "Support reactif et suivi continu. Nous sommes a votre ecoute avant et apres l'achat." },
  { icon: 'fa-solid fa-leaf',        title: 'Developpement durable',      desc: 'Solutions eco-responsables qui reduisent la consommation de bouteilles en plastique.' },
];

export default function FeaturesSection() {
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('revealed'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('#features .reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" className="py-24 px-4" style={{ background: 'var(--bg)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 reveal">
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold mb-4">
            Pourquoi choisir <span className="gradient-text">EAUMALIK</span> ?
          </h2>
          <p className="max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Notre engagement, votre confiance. Des solutions sur mesure pour chaque besoin en traitement de l&apos;eau.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="glass-card p-6 reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-dark))' }}>
                <i className={`${f.icon} text-white`} aria-hidden="true" />
              </div>
              <h3 className="font-display font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
