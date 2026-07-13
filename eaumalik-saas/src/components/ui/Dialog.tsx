'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Boite de dialogue unifiee EAUMALIK.
 *
 * Toutes les modales de l'app doivent utiliser ce composant afin de garantir :
 *   - Backdrop identique : `modal-overlay` (fond assombri + `backdrop-filter: blur(8px)`)
 *   - Surface identique  : `modal-surface` (carte arrondie + bordure + ombre)
 *   - Animation d'ouverture : `animate-modal-in`
 *   - Bouton de fermeture X en haut a droite
 *   - Fermeture via : clic backdrop, touche Echap, bouton X (verrouillable via `dismissible`)
 *   - Accessibilite : `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
 *   - Verrou du scroll body pendant l'ouverture
 *
 * Trois slots :
 *   - `title`   : optionnel (icone + texte). Si absent, le header est masque (utile pour les
 *                 modales "catalogue" plein ecran type boutique product card).
 *   - `children`: contenu principal.
 *   - `footer`  : optionnel. Bandeau d'actions en bas (boutons `btn-outline` + `btn-primary`).
 *
 * Tailles :
 *   - `sm`  : max-w-md   (~ 28rem) — confirmations, formulaires legers
 *   - `md`  : max-w-xl   (~ 36rem) — formulaire membre (defaut)
 *   - `lg`  : max-w-2xl  (~ 42rem) — detail commande / client
 *   - `xl`  : max-w-3xl  (~ 48rem) — boutique produit
 *   - `full`: max-w-5xl  (~ 64rem) — formulaires complexes
 */
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * Variante visuelle :
 *   - `default` : applique `modal-surface` (carte unifiee, couleurs de la charte)
 *   - `bare`    : laisse l'auteur styliser librement la surface (utile pour les modales
 *                 de type "carte produit" avec image hero + couleurs marketing).
 *                 Le backdrop reste identique et unifie.
 */
export type DialogVariant = 'default' | 'bare';

const SIZE_CLASS: Record<DialogSize, string> = {
  sm:   'max-w-md',
  md:   'max-w-xl',
  lg:   'max-w-2xl',
  xl:   'max-w-3xl',
  full: 'max-w-5xl',
};

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Petit texte sous le titre (ex : id, mention secondaire). */
  subtitle?: string;
  /** Icone optionnelle affichee a gauche du titre (ex : `lucide-react` element). */
  icon?: ReactNode;
  /** Taille max-width de la surface (cf. `DialogSize`). */
  size?: DialogSize;
  /** Variante visuelle. `default` pour toutes les modales courantes, `bare` pour les modales marketing. */
  variant?: DialogVariant;
  /** Hauteur max : `90vh` par defaut, `none` pour laisser grandir. */
  maxHeight?: 'default' | 'tall' | 'none';
  /** Contenu de la zone centrale. */
  children?: ReactNode;
  /** Footer : typiquement 2 boutons Annuler / Valider (classe `btn-outline` + `btn-primary`). */
  footer?: ReactNode;
  /** Masquer le bouton X (utile pour les modales non-dismissibles). Defaut : false. */
  hideCloseButton?: boolean;
  /** Autorise la fermeture par clic backdrop / Echap / X. `true` par defaut. */
  dismissible?: boolean;
  /** Z-index : 1000 par defaut ; utiliser 1100 pour empiler par-dessus une autre modale. */
  zIndex?: number;
  /** Active `animate-modal-in` au montage. `true` par defaut. */
  animate?: boolean;
}

export default function Dialog({
  open,
  onClose,
  title,
  subtitle,
  icon,
  size = 'md',
  variant = 'default',
  maxHeight = 'default',
  children,
  footer,
  hideCloseButton = false,
  dismissible = true,
  zIndex = 1000,
  animate = true,
}: DialogProps) {
  // Verrou du scroll + raccourci Echap
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;

  const titleId = title ? 'dialog-title' : undefined;

  const heightClass =
    maxHeight === 'none'  ? '' :
    maxHeight === 'tall'  ? 'max-h-[95vh]' :
                            'max-h-[90vh]';

  const surfaceClasses = variant === 'default'
    ? [
        'modal-surface',
        SIZE_CLASS[size],
        heightClass,
        maxHeight === 'none' ? '' : 'overflow-y-auto',
      ].filter(Boolean).join(' ')
    : [
        SIZE_CLASS[size],
        heightClass,
        maxHeight === 'none' ? '' : 'overflow-y-auto',
      ].filter(Boolean).join(' ');

  return (
    <div
      className={[
        'modal-overlay fixed inset-0 flex items-center justify-center p-4',
        animate ? 'animate-modal-in' : '',
      ].filter(Boolean).join(' ')}
      style={{ zIndex }}
      onClick={(e) => {
        if (!dismissible) return;
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={[
          'relative w-full',
          surfaceClasses,
          variant === 'default' ? 'rounded-3xl' : 'rounded-3xl',
        ].filter(Boolean).join(' ')}
        style={variant === 'bare' ? { background: 'var(--modal-surface)' } : undefined}
      >
        {/* Bouton fermer */}
        {dismissible && !hideCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-4 right-4 z-20 w-9 h-9 rounded-xl flex items-center justify-center hover:opacity-80 transition"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--modal-text)',
            }}
          >
            <X size={16} />
          </button>
        )}

        {/* Header sticky (titre + sous-titre + icone) */}
        {title && variant === 'default' && (
          <div
            className="px-6 pt-6 pb-4 border-b"
            style={{ borderColor: 'var(--modal-border)' }}
          >
            <h3
              id={titleId}
              className="font-display font-extrabold text-lg flex items-center gap-2 pr-12"
              style={{ color: 'var(--modal-text)' }}
            >
              {icon && <span className="text-primary-light flex-shrink-0">{icon}</span>}
              <span>{title}</span>
            </h3>
            {subtitle && (
              <p
                className="text-xs mt-1"
                style={{ color: 'var(--modal-text-muted)' }}
              >
                {subtitle}
              </p>
            )}
          </div>
        )}

        {/* Contenu */}
        <div className={title && variant === 'default' ? 'p-6' : 'p-0'}>
          {children}
        </div>

        {/* Footer sticky */}
        {footer && variant === 'default' && (
          <div
            className="px-6 py-4 border-t flex flex-col-reverse sm:flex-row gap-3 sm:justify-end"
            style={{ borderColor: 'var(--modal-border)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
