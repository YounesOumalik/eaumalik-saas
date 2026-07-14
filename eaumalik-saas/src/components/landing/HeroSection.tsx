import Link from 'next/link';
import { Droplets, ShieldCheck, ArrowRight } from 'lucide-react';

export default function HeroSection() {
  return (
    <section
      id="accueil"
      className="relative h-[90vh] flex items-center justify-center overflow-hidden rounded-b-[3rem]"
      style={{ background: 'linear-gradient(135deg,#0f766e 0%,#134e4a 50%,#1c1917 100%)' }}
    >
      {/* Halos décoratifs */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-brand-400 blur-[100px]" />
        <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-blue-400 blur-[120px]" />
      </div>

      {/* Particules d'eau flottantes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-brand-300/40 animate-water-drop" style={{ animationDelay: '0s' }} />
        <div className="absolute top-1/3 left-1/2 w-3 h-3 rounded-full bg-brand-200/30 animate-water-drop" style={{ animationDelay: '0.5s' }} />
        <div className="absolute top-1/5 right-1/3 w-2 h-2 rounded-full bg-blue-300/30 animate-water-drop" style={{ animationDelay: '1s' }} />
        <div className="absolute top-2/3 left-1/3 w-1.5 h-1.5 rounded-full bg-brand-400/20 animate-water-drop" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 right-1/4 w-2.5 h-2.5 rounded-full bg-cyan-300/25 animate-water-drop" style={{ animationDelay: '0.8s' }} />
      </div>

      <div className="relative z-10 text-center px-6 max-w-5xl">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-brand-200 text-xs font-bold uppercase tracking-[0.3em] mb-8">
          <ShieldCheck className="w-4 h-4" />
          L&apos;eau pure, notre engagement
        </div>

        <h1 className="font-serif text-5xl md:text-8xl font-normal text-white leading-[0.85] tracking-tighter mb-8">
          Catalogue<br /><em className="text-brand-300 not-italic">Produits</em>
        </h1>

        <p className="text-lg md:text-xl text-stone-300 font-light max-w-2xl mx-auto mb-10 leading-relaxed">
          Découvrez notre gamme complète de systèmes de filtration, fontaines et consommables pour une eau pure et saine.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="#catalogue"
            className="px-8 py-4 bg-brand-500 hover:bg-brand-400 text-white rounded-2xl text-sm font-bold uppercase tracking-wide transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(20,184,166,0.4)] flex items-center justify-center gap-2"
          >
            Voir le catalogue
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="#filtration"
            className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-sm font-bold uppercase tracking-wide transition-all duration-300 border border-white/10 flex items-center justify-center"
          >
            Comment ça marche
          </Link>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="w-6 h-10 rounded-full border-2 border-white/30 flex justify-center pt-2">
          <div className="w-1 h-2 rounded-full bg-white/60 animate-bounce" />
        </div>
      </div>
    </section>
  );
}
