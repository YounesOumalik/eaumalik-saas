'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { News } from '@/types';
import { formatCurrency, formatDate, daysUntil } from '@/lib/utils';
import { Sparkles, Tag, Clock, Newspaper, ArrowRight } from 'lucide-react';

interface Props {
  promotions: News[];
  news?: News[];
  /** Affiche l'onglet "Actualités" (désactivé sur la boutique : uniquement promos + articles à vendre). */
  showNews?: boolean;
}

const PERCENT = (original: number, promo: number): number => {
  if (!original || original <= 0 || !promo || promo <= 0) return 0;
  return Math.round(((original - promo) / original) * 100);
};

const BADGE_COLOR: Record<string, string> = {
  promo: 'bg-brand-600 text-white',
  info: 'bg-blue-600 text-white',
  news: 'bg-stone-700 text-white',
};

function PromotionCard({ promo }: { promo: News }) {
  const hasPrice = typeof promo.price === 'number' && promo.price > 0;
  const hasOriginal =
    typeof promo.original_price === 'number' && (promo.original_price as number) > 0;
  const discount = hasPrice && hasOriginal ? PERCENT(promo.original_price!, promo.price!) : 0;
  const remaining =
    promo.valid_until ? Math.max(0, daysUntil(promo.valid_until)) : null;
  return (
    <article
      className="group bg-white rounded-3xl border border-stone-100 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 flex flex-col"
      aria-label={`Promotion: ${promo.title}`}
    >
      <div className="relative h-44 bg-gradient-to-br from-brand-50 via-cyan-50 to-blue-50 flex items-center justify-center overflow-hidden">
        {promo.image_url ? (
          <Image
            src={promo.image_url}
            alt={promo.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-brand-600">
            <Sparkles className="w-12 h-12" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-[0.25em]">
              Offre du moment
            </span>
          </div>
        )}
        {discount > 0 && (
          <span className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-rose-600 text-white text-[11px] font-extrabold uppercase tracking-wider shadow-lg shadow-rose-600/30">
            -{discount}%
          </span>
        )}
        <span className="absolute top-4 right-4 px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm text-brand-700 text-[11px] font-bold uppercase tracking-wider border border-brand-100">
          <Tag className="inline-block w-3 h-3 mr-1 -mt-0.5" aria-hidden="true" />
          Promo
        </span>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <h3 className="font-serif text-xl md:text-2xl text-stone-900 leading-snug mb-2">
          {promo.title}
        </h3>
        <p className="text-sm text-stone-500 font-light line-clamp-3 mb-4">
          {promo.content}
        </p>

        <div className="mt-auto space-y-3">
          {hasPrice && (
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-brand-700">
                {formatCurrency(promo.price!)}
              </span>
              {hasOriginal && (
                <span className="text-sm text-stone-400 line-through">
                  {formatCurrency(promo.original_price!)}
                </span>
              )}
            </div>
          )}

          {remaining !== null && (
            <div
              className={`flex items-center gap-2 text-xs font-semibold ${
                remaining <= 3 ? 'text-rose-600' : 'text-stone-500'
              }`}
            >
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              {remaining === 0
                ? 'Dernière journée !'
                : `Plus que ${remaining} jour${remaining > 1 ? 's' : ''}`}
            </div>
          )}

          <Link
            href="/boutique#catalogue"
            className="inline-flex items-center gap-2 text-sm font-bold text-brand-700 hover:text-brand-800 transition-colors group/cta"
          >
            En profiter
            <ArrowRight
              className="w-4 h-4 transition-transform group-hover/cta:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </article>
  );
}

function NewsCard({ item }: { item: News }) {
  return (
    <article
      className="group bg-white rounded-3xl border border-stone-100 p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-500 flex flex-col gap-4"
      aria-label={`Actualité: ${item.title}`}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-stone-600 text-[11px] font-bold uppercase tracking-wider">
          <Newspaper className="w-3 h-3" aria-hidden="true" />
          Actualité
        </span>
        <time className="text-xs text-stone-400" dateTime={item.created_at}>
          {formatDate(item.created_at)}
        </time>
      </div>
      <h3 className="font-serif text-lg md:text-xl text-stone-900 leading-snug">
        {item.title}
      </h3>
      <p className="text-sm text-stone-500 font-light leading-relaxed line-clamp-3">
        {item.content}
      </p>
      <div className="mt-auto pt-2 border-t border-stone-100">
        <Link
          href="/boutique#contact"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:text-brand-800 transition-colors"
        >
          Nous contacter
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

/**
 * Bloc "Offres & Actualités" inséré dans la boutique (et sur la page d'accueil).
 *  - Carrousel horizontal des promotions (auto-scroll mobile + grilles desktop).
 *  - Grille des actualités (informations non commerciales).
 * Hydratation-safe : dates / discount calculés côté rendu, mais on évite tout accès
 * à `window` au premier render pour ne pas casser la SSR.
 */
export default function BoutiquePromotions({
  promotions,
  news = [],
  showNews = true,
}: Props) {
  // État client uniquement : filtre onglet actifs. Démarre sur "promotions".
  const [tab, setTab] = useState<'promotions' | 'news'>('promotions');

  // On exclut les éléments sans contenu visible et on déduplique par id.
  const promoList = useMemo(
    () =>
      (promotions || [])
        .filter(p => p && p.title && p.content)
        .sort((a, b) => (b.created_at > a.created_at ? 1 : -1)),
    [promotions],
  );

  const newsList = useMemo(
    () =>
      (news || [])
        // On retire les news qui sont déjà des promos pour éviter le doublon visuel.
        .filter(n => n && n.title && n.content && !n.is_promotion)
        .sort((a, b) => (b.created_at > a.created_at ? 1 : -1)),
    [news],
  );

  // Si aucune donnée : on n'affiche pas la section (au lieu d'une zone vide).
  if (promoList.length === 0 && (!showNews || newsList.length === 0)) return null;

  return (
    <section
      id="offres"
      className="py-24 px-6 bg-gradient-to-b from-white to-stone-50"
      aria-labelledby="offres-title"
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 reveal">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand-600 mb-4 block">
            Offres du moment
          </span>
          <h2
            id="offres-title"
            className="font-serif text-4xl md:text-6xl font-normal leading-[0.85] tracking-tighter mb-6 text-stone-900"
          >
            Promotions &amp;
            <br />
            <em className="text-brand-700">actualités</em>
          </h2>
          <p className="text-lg text-stone-500 font-light max-w-xl mx-auto">
            Profitez de nos offres en cours et restez informé des dernières
            actualités EAUMALIK.
          </p>
        </div>

        {/* Onglets */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10" role="tablist">
          <button
            type="button"
            onClick={() => setTab('promotions')}
            className={`btn-chip ${tab === 'promotions' ? 'active btn-chip-fill' : ''}`}
            aria-pressed={tab === 'promotions'}
          >
            <Sparkles className="inline-block w-4 h-4 mr-1.5 -mt-0.5" aria-hidden="true" />
            Promotions ({promoList.length})
          </button>
          {showNews && (
            <button
              type="button"
              onClick={() => setTab('news')}
              className={`btn-chip ${tab === 'news' ? 'active btn-chip-fill' : ''}`}
              aria-pressed={tab === 'news'}
            >
              <Newspaper className="inline-block w-4 h-4 mr-1.5 -mt-0.5" aria-hidden="true" />
              Actualités ({newsList.length})
            </button>
          )}
        </div>

        {tab === 'promotions' && promoList.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {promoList.map(p => (
              <PromotionCard key={p.id} promo={p} />
            ))}
          </div>
        )}

        {tab === 'promotions' && promoList.length === 0 && (
          <p className="text-center text-stone-400 italic">
            Aucune promotion en cours. Revenez bientôt !
          </p>
        )}

        {showNews && tab === 'news' && newsList.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {newsList.map(n => (
              <NewsCard key={n.id} item={n} />
            ))}
          </div>
        )}

        {showNews && tab === 'news' && newsList.length === 0 && (
          <p className="text-center text-stone-400 italic">
            Aucune actualité publiée pour le moment.
          </p>
        )}
      </div>
    </section>
  );
}
