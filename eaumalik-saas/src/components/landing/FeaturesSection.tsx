'use client';

const FEATURES = [
  { icon: 'fa-solid fa-award',       title: 'Expertise professionnelle',  desc: "Plusieurs années d'expérience dans le traitement et la purification de l'eau au Maroc." },
  { icon: 'fa-solid fa-shield-halved', title: 'Produits de qualite',        desc: 'Equipements certifies et testes pour garantir une performance optimale et une duree de vie maximale.' },
  { icon: 'fa-solid fa-droplet',     title: 'Eau pure et sure',           desc: "Elimination de jusqu'a 99% des impuretes, bacteries et contaminants pour une eau saine." },
  { icon: 'fa-solid fa-wrench',      title: 'Installation professionnelle', desc: 'Nos techniciens qualifies assurent une installation rapide et conforme aux normes.' },
  { icon: 'fa-solid fa-headset',     title: 'Service après-vente',        desc: "Support réactif et suivi continu. Nous sommes à votre écoute avant et après l'achat." },
  { icon: 'fa-solid fa-leaf',        title: 'Developpement durable',      desc: 'Solutions eco-responsables qui reduisent la consommation de bouteilles en plastique.' },
];

// L'animation au scroll (.reveal → .revealed) est gérée globalement par
// <RevealOnScroll /> dans Providers.tsx, plus par cette section.
// Design aligné sur la page boutique (font-serif, brand-*, stone-*).
export default function FeaturesSection() {
  return (
    <section id="features" className="py-32 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 reveal">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand-600 mb-4 block">
            Notre engagement
          </span>
          <h2 className="font-serif text-4xl md:text-6xl font-normal leading-[0.85] tracking-tighter mb-6 text-stone-900">
            Pourquoi choisir <em className="text-brand-700">EAUMALIK</em> ?
          </h2>
          <p className="text-lg text-stone-500 font-light max-w-xl mx-auto">
            Notre engagement, votre confiance. Des solutions sur mesure pour chaque besoin en traitement de l&apos;eau.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="bg-white rounded-3xl border border-stone-100 p-8 reveal hover:shadow-xl hover:-translate-y-1 transition-all duration-500"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 bg-brand-50">
                <i className={`${f.icon} text-brand-600`} aria-hidden="true" />
              </div>
              <h3 className="font-serif font-semibold text-xl mb-2 text-stone-900">{f.title}</h3>
              <p className="text-sm leading-relaxed text-stone-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
