'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Sparkles, Tag, Clock } from 'lucide-react';
import { formatCurrency, formatDate, daysUntil } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================
export type CarouselPromotion = {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  price: number | null;
  original_price: number | null;
  product_ids: string[];
  valid_until: string | null;
  created_at: string;
};

interface Props {
  promotions: CarouselPromotion[];
}

// ============================================================================
// Composant
// ============================================================================
export default function PromotionsCarousel({ promotions }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Si on n'a aucune promotion, on n'affiche rien (la section reste cachée).
  if (!promotions || promotions.length === 0) return null;

  // -----------------------------------------------------------------
  // Auto-scroll : translateX progressif via rAF, accéléré au survol off
  // -----------------------------------------------------------------
  useEffect(() => {
    let raf = 0;
    let lastTs = performance.now();
    const speed = 28; // pixels / seconde
    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      const el = trackRef.current;
      if (el && !paused) {
        // Demi-vue : on boucle quand la moitié du contenu scrolled (track doublé).
        const half = el.scrollWidth / 2;
        el.scrollLeft += speed * dt;
        if (half > 0 && el.scrollLeft >= half) {
          el.scrollLeft -= half;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  // -----------------------------------------------------------------
  // Boutons prev / next
  // -----------------------------------------------------------------
  const scrollByViewport = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-card]');
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
    setPaused(true);
    setTimeout(() => setPaused(false), 4000);
  };

  // -----------------------------------------------------------------
  // Suivi de l'index actif pour les dots
  // -----------------------------------------------------------------
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-card]');
    if (!card) return;
    const onScroll = () => {
      const step = card.offsetWidth + 16;
      const idx = Math.round(el.scrollLeft / step) % promotions.length;
      setActiveIndex(((idx % promotions.length) + promotions.length) % promotions.length);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [promotions.length]);

  // -----------------------------------------------------------------
  // Rendu d'une carte promotion
  // -----------------------------------------------------------------
  const renderCard = (p: CarouselPromotion, key: string) => {
    const hasPrice = typeof p.price === 'number' && p.price > 0;
    const hasOriginal = typeof p.original_price === 'number' && p.original_price > 0;
    const discount =
      hasPrice && hasOriginal && p.original_price! > 0
        ? Math.max(0, Math.round((1 - p.price! / p.original_price!) * 100))
        : null;
    const validIn = p.valid_until ? daysUntil(p.valid_until) : null;

    return (
      <article
        key={key}
        data-card
        className="snap-start shrink-0 w-[18rem] sm:w-[22rem] group relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg-card)] shadow-md hover:shadow-xl transition-shadow"
      >
        {/* Image / couverture */}
        <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-[color:var(--bg-surface)]">
          {p.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={p.image_url}
              alt={p.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-warning/10">
              <Sparkles className="w-12 h-12 opacity-40 text-primary-light" />
            </div>
          )}
          {discount !== null && (
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-extrabold bg-warning text-bg shadow-lg">
              -{discount}%
            </div>
          )}
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[color:var(--primary)] text-white flex items-center gap-1 shadow-md">
            <Tag size={10} /> PROMO
          </div>
        </div>

        {/* Contenu */}
        <div className="p-5 space-y-2">
          <div className="text-[10px] uppercase font-bold tracking-wider text-primary-400">
            {formatDate(p.created_at)}
          </div>
          <h3 className="font-display font-bold text-lg leading-snug line-clamp-2">
            {p.title}
          </h3>
          <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
            {p.content}
          </p>

          {hasPrice && (
            <div className="flex items-end gap-2 pt-1">
              <span className="font-display font-extrabold text-2xl text-warning">
                {formatCurrency(p.price!)}
              </span>
              {hasOriginal && (
                <span className="text-xs line-through opacity-60">
                  {formatCurrency(p.original_price!)}
                </span>
              )}
            </div>
          )}

          {validIn !== null && (
            <div className={`flex items-center gap-1 text-[11px] pt-1 ${
              validIn <= 7 ? 'text-warning' : 'opacity-60'
            }`}>
              <Clock size={11} />
              {validIn > 0
                ? `Expire dans ${validIn} jour${validIn > 1 ? 's' : ''}`
                : 'Expiré'}
            </div>
          )}

          <Link
            href="/boutique"
            className="btn-primary w-full justify-center py-2 text-xs mt-3"
          >
            Voir l&apos;offre →
          </Link>
        </div>
      </article>
    );
  };

  // -----------------------------------------------------------------
  // Rendu principal
  // -----------------------------------------------------------------
  const sorted = [...promotions].sort((a, b) => b.created_at.localeCompare(a.created_at));
  // On double le track pour permettre le loop infini sans "saut".
  const looped = sorted.length > 1 ? [...sorted, ...sorted] : sorted;

  return (
    <section
      className="py-20 px-4 relative overflow-hidden reveal"
      style={{ background: 'linear-gradient(135deg, var(--bg-surface), var(--bg))' }}
      aria-label="Promotions et actualités"
    >
      <div className="max-w-7xl mx-auto">
        {/* En-tête */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-4 bg-warning-soft text-warning">
            <Sparkles size={16} />
            Offres du moment
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold mb-3">
            Nos <span className="gradient-text">promotions</span> en cours
          </h2>
          <p className="max-w-xl mx-auto text-sm" style={{ color: 'var(--text-secondary)' }}>
            Profitez de nos offres spéciales sur les filtres, purificateurs et fontaines
            EAUMALIK. Défilez pour découvrir toutes nos promotions du moment.
          </p>
        </div>

        {/* Carousel */}
        <div
          className="relative group"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Boutons gauche / droite */}
          <button
            type="button"
            aria-label="Précédent"
            onClick={() => scrollByViewport(-1)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[color:var(--bg-card)] border border-[color:var(--border)] shadow-lg flex items-center justify-center hover:bg-primary hover:text-white transition-colors -translate-x-1/2 opacity-0 group-hover:opacity-100"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Suivant"
            onClick={() => scrollByViewport(1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[color:var(--bg-card)] border border-[color:var(--border)] shadow-lg flex items-center justify-center hover:bg-primary hover:text-white transition-colors translate-x-1/2 opacity-0 group-hover:opacity-100"
          >
            <ChevronRight size={18} />
          </button>

          {/* Track */}
          <div
            ref={trackRef}
            className="flex gap-4 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none]"
            style={{ scrollbarWidth: 'none' }}
          >
            {/* On cache la scrollbar webkit */}
            <style jsx>{`
              div::-webkit-scrollbar { display: none; }
            `}</style>
            {looped.map((p, idx) => renderCard(p, `${p.id}-${idx}`))}
          </div>

          {/* Dots */}
          {sorted.length > 1 && (
            <div className="flex justify-center gap-2 mt-4" aria-hidden="true">
              {sorted.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    const el = trackRef.current;
                    if (!el) return;
                    const card = el.querySelector<HTMLElement>('[data-card]');
                    if (!card) return;
                    const step = card.offsetWidth + 16;
                    el.scrollTo({ left: i * step, behavior: 'smooth' });
                    setPaused(true);
                    setTimeout(() => setPaused(false), 4000);
                  }}
                  className={`h-1.5 rounded-full transition-all ${
                    i === activeIndex
                      ? 'w-6 bg-warning'
                      : 'w-1.5 bg-[color:var(--border)]'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* CTA bas */}
        <div className="text-center mt-10">
          <Link
            href="/boutique"
            className="btn-outline text-sm px-6 py-2.5"
          >
            Voir toute la boutique →
          </Link>
        </div>
      </div>
    </section>
  );
}
