import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export default function HeroSection() {
  return (
    <section
      id="accueil"
      className="relative min-h-[90vh] flex items-center justify-center overflow-hidden rounded-b-[3rem] surface-cream"
    >
      {/* Halos crème / océan très subtils pour faire respirer le fond */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -left-20 w-[28rem] h-[28rem] rounded-full bg-ocean-200/25 dark:bg-ocean-400/15 blur-[120px]" />
        <div className="absolute -bottom-32 -right-20 w-[32rem] h-[32rem] rounded-full bg-ocean-300/20 dark:bg-ocean-500/15 blur-[140px]" />
      </div>

      {/* Grain léger pour la texture papier du fond crème */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 py-16 md:py-20 grid md:grid-cols-[1.1fr_1fr] gap-10 md:gap-16 items-center">
        {/* === Bloc texte === */}
        <div className="text-center md:text-left order-2 md:order-1">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-soft text-xs font-bold uppercase tracking-[0.3em] mb-6"
            style={{ background: 'var(--primary-glow)', color: 'var(--primary)' }}
          >
            <ShieldCheck className="w-4 h-4" />
            L&apos;eau pure, notre engagement
          </div>

          <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl font-normal leading-[0.95] tracking-tight mb-5 text-heading">
            L&apos;expertise<br />
            <span className="gradient-text inline-block">EAUMALIK</span><br />
            <em className="not-italic text-2xl md:text-3xl lg:text-4xl font-light text-meta">
              au service de votre eau
            </em>
          </h1>

          <p className="text-base md:text-lg font-light max-w-xl md:mx-0 mx-auto mb-8 leading-relaxed text-body">
            Découvrez notre gamme complète de systèmes de filtration, fontaines et consommables
            pour une eau pure et saine — à domicile ou en industrie.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 md:justify-start justify-center">
            <Link
              href="#catalogue"
              className="btn-primary px-7 py-3.5 text-sm font-bold uppercase tracking-wide transition-all duration-300 hover:scale-[1.03] flex items-center justify-center gap-2"
            >
              Voir le catalogue
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="#filtration"
              className="px-7 py-3.5 rounded-2xl text-sm font-bold uppercase tracking-wide transition-all duration-300 btn-outline border-soft flex items-center justify-center"
            >
              Comment ça marche
            </Link>
          </div>

          {/* Bandeau de réassurance */}
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-md md:mx-0 mx-auto">
            {[
              { k: '15+', v: 'années' },
              { k: '5000+', v: 'clients' },
              { k: '24/7', v: 'support' },
            ].map((s) => (
              <div key={s.v} className="text-center md:text-left">
                <div className="font-serif text-2xl md:text-3xl leading-none gradient-text">{s.k}</div>
                <div className="text-[0.65rem] uppercase tracking-[0.2em] mt-1 text-meta">{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* === Bloc logo géant === */}
        <div className="order-1 md:order-2 flex items-center justify-center">
          <div className="relative w-full max-w-[1100px] aspect-square" style={{ filter: 'drop-shadow(0 30px 60px rgba(2, 132, 199, 0.18))' }}>
            <Image
              src="/logo.png"
              alt="EAUMALIK SARL — Captage, traitement et distribution d'eau"
              fill
              priority
              sizes="(max-width: 768px) 80vw, (max-width: 1280px) 45vw, 560px"
              className="object-contain select-none"
              draggable={false}
            />
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
        <div className="w-6 h-10 rounded-full border-2 border-soft flex justify-center pt-2">
          <div className="w-1 h-2 rounded-full animate-bounce" style={{ background: 'var(--text-muted)' }} />
        </div>
      </div>
    </section>
  );
}
