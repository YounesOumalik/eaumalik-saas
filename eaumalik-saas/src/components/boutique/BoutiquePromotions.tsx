'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { News, Product } from '@/types';
import {
  formatCurrency,
  formatDate,
  daysUntil,
  shouldSkipImageOptimization,
} from '@/lib/utils';
import { Sparkles, Tag, Clock, Newspaper, ArrowRight, Lock, UserPlus } from 'lucide-react';
import { useCart } from '@/components/shared/CartProvider';
import { useToast } from '@/components/shared/ToastProvider';
import { useSupabaseAuth } from '@/components/shared/SupabaseAuthProvider';

// Lien de la promo → invite : ajout bloque tant que la connexion / inscription
// n'est pas faite (meme regle que le catalogue, voir ProductCard).

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

/**
 * Carte promotion : le bouton "En profiter" ajoute les produits liés au panier
 * (selon `product_ids`) puis exige la création de compte / connexion AVANT de
 * laisser l'utilisateur accéder au panier pour finaliser la commande.
 *
 * Cas gerés :
 *  - Pas authentifié → redirection vers /login?callbackUrl=/panier
 *  - Authentifié → ajout au panier + redirection vers /panier
 *  - Pas de product_ids → fallback sur /boutique#catalogue (vente libre)
 */
function PromotionCard({ promo }: { promo: News }) {
  const router = useRouter();
  const toast = useToast();
  const { add } = useCart();
  const { session } = useSupabaseAuth();
  const [adding, setAdding] = useState(false);

  const hasPrice = typeof promo.price === 'number' && promo.price > 0;
  const hasOriginal =
    typeof promo.original_price === 'number' && (promo.original_price as number) > 0;
  const discount = hasPrice && hasOriginal ? PERCENT(promo.original_price!, promo.price!) : 0;
  const remaining = promo.valid_until ? Math.max(0, daysUntil(promo.valid_until)) : null;
  const hasLinkedProducts = Array.isArray(promo.product_ids) && promo.product_ids.length > 0;

  /**
   * Calcule le prix unitaire à appliquer pour la promotion :
   *  - Si la promo a un prix global et plusieurs produits liés, on répartit
   *    équitablement (price / nbProducts).
   *  - Si un seul produit et un prix global → ce prix-là.
   *  - Sinon : null (on laisse le prix catalogue).
   */
  const computePromoUnitPrice = (products: Product[]): number | null => {
    if (!hasPrice) return null;
    if (products.length === 0) return null;
    if (products.length === 1) return promo.price!;
    // Répartition équitable du prix promo sur l'ensemble des produits.
    return Math.round((promo.price! / products.length) * 100) / 100;
  };

  const handleEnjoy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (adding) return;

    // Pas de produit lié : on bascule sur la vue catalogue de la boutique.
    if (!hasLinkedProducts) {
      router.push('/boutique#catalogue');
      return;
    }

    // Pas authentifié : on exige la création/connexion AVANT l'ajout au panier.
    if (!session) {
      toast('Veuillez vous inscrire ou vous connecter pour profiter de cette offre.', 'info');
      router.push(`/login?callbackUrl=${encodeURIComponent('/panier')}`);
      return;
    }

    // Authentifié : on charge les produits liés et on les ajoute au panier.
    try {
      setAdding(true);
      let products: Product[] = [];

      // 1) Tentative via le filtre serveur `ids=` (si supporté).
      const idsRes = await fetch(
        `/api/products?ids=${encodeURIComponent(promo.product_ids.join(','))}`,
        { cache: 'no-store' },
      ).catch(() => null);

      if (idsRes && idsRes.ok) {
        const json = await idsRes.json();
        if (Array.isArray(json)) {
          products = (json as Product[]).filter((p) => promo.product_ids.includes(p.id));
        }
      }

      // 2) Fallback : on charge tout le catalogue et on filtre côté client.
      if (products.length === 0) {
        const allRes = await fetch('/api/products', { cache: 'no-store' });
        if (allRes.ok) {
          const all = (await allRes.json()) as Product[];
          products = all.filter((p) => promo.product_ids.includes(p.id));
        }
      }

      if (products.length === 0) {
        toast('Produits de la promotion introuvables. Redirection vers la boutique.', 'error');
        router.push('/boutique#catalogue');
        return;
      }

      const unitPrice = computePromoUnitPrice(products);

      products.forEach((p) => {
        // On n'augmente jamais le prix catalogue si le calcul promo dépasse.
        const priceToApply =
          unitPrice !== null ? Math.min(p.price, unitPrice) : p.price;
        add({
          product_id: p.id,
          name: p.name,
          price: priceToApply,
          image_url: p.image_url,
          quantity: 1,
        });
      });

      const summary =
        products.length === 1
          ? `${products[0].name} ajouté au panier`
          : `${products.length} articles ajoutés au panier`;
      toast(`${summary} — finalisez votre commande`, 'success');
      router.push('/panier');
    } catch (err) {
      toast("Erreur lors de l'ajout au panier. Veuillez réessayer.", 'error');
      router.push('/boutique#catalogue');
    } finally {
      setAdding(false);
    }
  };

  return (
    <article
      className="group rounded-3xl border border-[color:var(--border)] overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 flex flex-col bg-[color:var(--bg-card)]"
      aria-label={`Promotion: ${promo.title}`}
    >
      <div className="relative h-44 bg-gradient-to-br from-brand-50 via-cyan-50 to-blue-50 dark:from-[color:var(--bg-surface)] dark:via-[color:var(--bg-surface)] dark:to-[color:var(--bg-card)] flex items-center justify-center overflow-hidden">
        {promo.image_url ? (
          <Image
            src={promo.image_url}
            alt={promo.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
            unoptimized={shouldSkipImageOptimization(promo.image_url)}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-brand-600 dark:text-brand-300">
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
        <span className="absolute top-4 right-4 px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm text-brand-700 text-[11px] font-bold uppercase tracking-wider border border-brand-100 dark:bg-[color:var(--bg-surface)]/90 dark:text-brand-300 dark:border-[color:var(--border)]">
          <Tag className="inline-block w-3 h-3 mr-1 -mt-0.5" aria-hidden="true" />
          Promo
        </span>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <h3 className="font-serif text-xl md:text-2xl leading-snug mb-2 text-[color:var(--text)]">
          {promo.title}
        </h3>
        <p className="text-sm font-light line-clamp-3 mb-4 text-[color:var(--text-muted)]">
          {promo.content}
        </p>

        <div className="mt-auto space-y-3">
          {hasPrice && (
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-brand-700 dark:text-brand-300">
                {formatCurrency(promo.price!)}
              </span>
              {hasOriginal && (
                <span className="text-sm line-through text-[color:var(--text-muted)]">
                  {formatCurrency(promo.original_price!)}
                </span>
              )}
            </div>
          )}

          {remaining !== null && (
            <div
              className={`flex items-center gap-2 text-xs font-semibold ${
                remaining <= 3 ? 'text-rose-600 dark:text-rose-400' : 'text-[color:var(--text-muted)]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              {remaining === 0
                ? 'Dernière journée !'
                : `Plus que ${remaining} jour${remaining > 1 ? 's' : ''}`}
            </div>
          )}

          <button
            type="button"
            onClick={handleEnjoy}
            disabled={adding}
            className="inline-flex items-center gap-2 text-sm font-bold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200 transition-colors group/cta disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {hasLinkedProducts ? (
              session ? (
                <>
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  {adding ? 'Ajout en cours…' : 'En profiter & commander'}
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  S&apos;inscrire pour en profiter
                </>
              )
            ) : (
              <>
                En profiter
                <ArrowRight
                  className="w-4 h-4 transition-transform group-hover/cta:translate-x-1"
                  aria-hidden="true"
                />
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

function NewsCard({ item }: { item: News }) {
  return (
    <article
      className="group rounded-3xl border border-[color:var(--border)] p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-500 flex flex-col gap-4 bg-[color:var(--bg-card)]"
      aria-label={`Actualité: ${item.title}`}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[color:var(--bg-surface)] text-[color:var(--text-secondary)] border border-[color:var(--border)]">
          <Newspaper className="w-3 h-3" aria-hidden="true" />
          Actualité
        </span>
        <time className="text-xs text-[color:var(--text-muted)]" dateTime={item.created_at}>
          {formatDate(item.created_at)}
        </time>
      </div>
      <h3 className="font-serif text-lg md:text-xl leading-snug text-[color:var(--text)]">
        {item.title}
      </h3>
      <p className="text-sm font-light leading-relaxed line-clamp-3 text-[color:var(--text-muted)]">
        {item.content}
      </p>
      <div className="mt-auto pt-2 border-t border-[color:var(--border)]">
        <Link
          href="/boutique#contact"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200 transition-colors"
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
      className="py-24 px-6 bg-gradient-to-b from-white to-stone-50 dark:from-[color:var(--bg-surface)] dark:to-[color:var(--bg)]"
      aria-labelledby="offres-title"
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 reveal">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand-600 dark:text-brand-300 mb-4 block">
            Offres du moment
          </span>
          <h2
            id="offres-title"
            className="font-serif text-4xl md:text-6xl font-normal leading-[0.85] tracking-tighter mb-6 text-stone-900 dark:text-[color:var(--text)]"
          >
            Promotions &amp;
            <br />
            <em className="text-brand-700 dark:text-brand-300">actualités</em>
          </h2>
          <p className="text-lg font-light max-w-xl mx-auto text-stone-500 dark:text-[color:var(--text-muted)]">
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
          <p className="text-center italic text-[color:var(--text-muted)]">
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
          <p className="text-center italic text-[color:var(--text-muted)]">
            Aucune actualité publiée pour le moment.
          </p>
        )}
      </div>
    </section>
  );
}
