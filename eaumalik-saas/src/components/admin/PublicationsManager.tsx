'use client';

import { useState } from 'react';
import { Megaphone, Tag, Newspaper, Check } from 'lucide-react';
import CrmNews from '@/components/crm/CrmNews';

/**
 * Page « Publier Actualité » située dans /admin/publications.
 *
 * Depuis juillet 2026, la gestion des messages clients n'est plus
 * accessible depuis cette page : elle a été déplacée dans la section
 * CRM (shell `/crm`, onglet « Messages Clients », route `/crm/messages`).
 *
 * Cette page ne sert plus qu'à composer / publier des actualités &
 * promotions (composant `CrmNews`, importé tel quel — aucune logique
 * métier n'est dupliquée).
 *
 * Le sélecteur de mode (Annonce ↔ Promotion spéciale) est affiché en
 * haut de la page sous forme de deux gros boutons clairement
 * différenciés (couleurs, icônes, descriptions). L'état est piloté ici
 * puis transmis à `CrmNews` via les props `isPromotion` /
 * `setIsPromotion`.
 *
 * Note technique :
 *  - Le rendu initial ne dépend d'AUCUNE action Supabase côté serveur
 *    → la page s'affiche même en mode dégradé (env var manquante).
 */
export default function PublicationsManager() {
  const [isPromotion, setIsPromotion] = useState(true);

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

      {/* ===================== SELECTEUR MODE (ANNONCE / PROMOTION) ===================== */}
      <div
        role="tablist"
        aria-label="Type de publication"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        <button
          type="button"
          role="tab"
          aria-selected={!isPromotion}
          onClick={() => setIsPromotion(false)}
          className={`group relative flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-2 text-left transition-all ${
            !isPromotion
              ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/30'
              : 'border-[color:var(--border)] bg-[color:var(--bg-surface)] hover:border-primary/40 hover:bg-[color:var(--bg)]'
          }`}
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
          onClick={() => setIsPromotion(true)}
          className={`group relative flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-2 text-left transition-all ${
            isPromotion
              ? 'border-warning bg-warning/10 shadow-md ring-2 ring-warning/30'
              : 'border-[color:var(--border)] bg-[color:var(--bg-surface)] hover:border-warning/40 hover:bg-[color:var(--bg)]'
          }`}
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
        <CrmNews isPromotion={isPromotion} setIsPromotion={setIsPromotion} />
      </section>
    </div>
  );
}

