'use client';

import { useCallback, useState } from 'react';
import {
  Megaphone, Tag, Newspaper, Check, List, Plus, X,
} from 'lucide-react';
import type { News } from '@/types';
import CrmNews from '@/components/crm/CrmNews';
import NewsList from '@/components/admin/NewsList';
import { listAdminNewsAction } from '@/app/actions/clientActions';

/**
 * Page « Publier Actualité » située dans /admin/publications.
 *
 * Depuis juillet 2026, la gestion des messages clients n'est plus
 * accessible depuis cette page : elle a été déplacée dans la section
 * CRM (shell `/crm`, onglet « Messages Clients », route `/crm/messages`).
 *
 * Cette page combine désormais :
 *   1. Un sélecteur de mode (Annonce ↔ Promotion spéciale) en haut,
 *   2. Un onglet "Gérer" listant toutes les publications existantes
 *      (composant `NewsList`) avec actions Modifier / Archiver
 *      (ou Restaurer) / Supprimer,
 *   3. Un onglet "Nouvelle publication" qui affiche le formulaire de
 *      création / édition (composant `CrmNews`).
 *
 * Le basculement entre mode création et mode édition se fait via l'état
 * `editingItem` : quand il est défini, le formulaire est pré-rempli et la
 * soumission appelle `updateNewsFromCrmAction` (gérée dans `CrmNews`).
 *
 * Note technique :
 *  - Le rendu initial ne dépend d'AUCUNE action Supabase côté serveur
 *    → la page s'affiche même en mode dégradé (env var manquante).
 *  - La liste initiale est passée en prop depuis le server component
 *    parent (`/admin/publications/page.tsx`). `NewsList` se resynchronise
 *    en local après chaque action (optimistic + appel server action).
 */
type Tab = 'compose' | 'manage';

export default function PublicationsManager({ initialNews = [] }: { initialNews?: News[] } = {}) {
  const [isPromotion, setIsPromotion] = useState(true);
  const [tab, setTab] = useState<Tab>('manage');
  const [editingItem, setEditingItem] = useState<News | null>(null);
  const [latestNews, setLatestNews] = useState<News[]>(initialNews);
  const [refreshKey, setRefreshKey] = useState(0);

  // Bascule en mode édition + onglet "Nouvelle publication" (compose)
  const handleEdit = useCallback((item: News) => {
    setEditingItem(item);
    // Aligne le sélecteur Annonce/Promotion sur le type de l'item édité
    setIsPromotion(item.is_promotion === true);
    setTab('compose');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingItem(null);
  }, []);

  /**
   * Quand le formulaire enregistre / publie :
   *  - on quitte le mode édition,
   *  - on rebascule sur l'onglet "Gérer",
   *  - on force la liste à se re-synchroniser depuis le serveur.
   */
  const handleSaved = useCallback(async (_saved: News) => {
    setEditingItem(null);
    setTab('manage');
    // Tente de recharger la liste maintenant. Si ça échoue, no-op :
    // la liste locale continuera d'afficher l'état précédent jusqu'à la
    // prochaine action de l'utilisateur.
    try {
      const res = await listAdminNewsAction();
      if (res.success && Array.isArray(res.news)) {
        setLatestNews(res.news as News[]);
      }
    } catch {
      /* no-op */
    }
    setRefreshKey(k => k + 1);
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <span className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white">
            <Megaphone size={20} aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-display font-extrabold text-2xl">Publier Actualité</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Composez et publiez vos actualités, promotions et communications
              client. La réponse aux messages se gère désormais dans la section
              CRM.
            </p>
          </div>
        </div>
      </header>

      {/* ===================== ONGLETS (Gérer / Nouvelle) ===================== */}
      <div
        role="tablist"
        aria-label="Mode de gestion des publications"
        className="flex flex-wrap items-center gap-2 border-b border-[color:var(--border)] pb-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'manage'}
          onClick={() => { setTab('manage'); setEditingItem(null); }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-semibold border-b-2 transition-colors ${
            tab === 'manage'
              ? 'border-primary text-primary'
              : 'border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]'
          }`}
        >
          <List size={16} />
          Gérer ({latestNews.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'compose'}
          onClick={() => { setTab('compose'); setEditingItem(null); }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-semibold border-b-2 transition-colors ${
            tab === 'compose'
              ? 'border-primary text-primary'
              : 'border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]'
          }`}
        >
          <Plus size={16} />
          {editingItem ? 'Modifier la publication' : 'Nouvelle publication'}
        </button>
        {editingItem && (
          <button
            type="button"
            onClick={handleCancelEdit}
            className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[color:var(--border)] bg-[color:var(--bg-surface)] hover:bg-[color:var(--bg)]"
            title="Quitter le mode édition"
          >
            <X size={14} /> Annuler l&apos;édition
          </button>
        )}
      </div>

      {/* ===================== CONTENU ONGLET ===================== */}
      {tab === 'manage' ? (
        <section aria-label="Gestion des publications" className="space-y-3">
          <NewsList
            key={refreshKey}
            initialNews={latestNews}
            onEdit={handleEdit}
          />
        </section>
      ) : (
        <>
          {/* Sélecteur Annonce / Promotion — désactivé en mode édition
              (le type est figé par l'élément qu'on édite). */}
          <div
            role="tablist"
            aria-label="Type de publication"
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isPromotion}
              onClick={() => !editingItem && setIsPromotion(false)}
              disabled={!!editingItem}
              className={`group relative flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-2 text-left transition-all ${
                !isPromotion
                  ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/30'
                  : 'border-[color:var(--border)] bg-[color:var(--bg-surface)] hover:border-primary/40 hover:bg-[color:var(--bg)]'
              } ${editingItem ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <span
                aria-hidden="true"
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  !isPromotion
                    ? 'bg-primary text-white'
                    : 'bg-[color:var(--bg)] text-primary'
                }`}
              >
                <Newspaper size={24} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-display font-extrabold text-base sm:text-lg leading-tight">
                  Annonce
                </span>
                <span
                  className="block text-xs mt-1 leading-snug"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Communication générale envoyée aux clients ciblés.
                </span>
              </span>
              {!isPromotion && (
                <span
                  aria-hidden="true"
                  className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center"
                >
                  <Check size={14} />
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={isPromotion}
              onClick={() => !editingItem && setIsPromotion(true)}
              disabled={!!editingItem}
              className={`group relative flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-2 text-left transition-all ${
                isPromotion
                  ? 'border-warning bg-warning/10 shadow-md ring-2 ring-warning/30'
                  : 'border-[color:var(--border)] bg-[color:var(--bg-surface)] hover:border-warning/40 hover:bg-[color:var(--bg)]'
              } ${editingItem ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <span
                aria-hidden="true"
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  isPromotion ? 'bg-warning text-white' : 'bg-[color:var(--bg)] text-warning'
                }`}
              >
                <Tag size={24} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-display font-extrabold text-base sm:text-lg leading-tight">
                  Promotion spéciale
                </span>
                <span
                  className="block text-xs mt-1 leading-snug"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Offre commerciale avec prix barré, visible dans le carrousel landing.
                </span>
              </span>
              {isPromotion && (
                <span
                  aria-hidden="true"
                  className="absolute top-3 right-3 w-6 h-6 rounded-full bg-warning text-white flex items-center justify-center"
                >
                  <Check size={14} />
                </span>
              )}
            </button>
          </div>

          <section aria-label="Publication d'actualité">
            <h2 className="sr-only">
              <Newspaper size={16} aria-hidden="true" /> Publication d&apos;actualité
            </h2>
            <CrmNews
              isPromotion={isPromotion}
              setIsPromotion={setIsPromotion}
              editingItem={editingItem}
              onSaved={handleSaved}
              onCancelEdit={handleCancelEdit}
            />
          </section>
        </>
      )}
    </div>
  );
}
