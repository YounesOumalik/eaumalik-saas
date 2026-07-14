/**
 * BrandLogo — rendu de l'identité visuelle d'EAUMALIK.
 *
 * Source unique : `/public/logo.png` (transparent, généré par
 * `scripts/process-logo.py` depuis `Produits/Logo Eaumalik.jpeg`).
 *
 * Variantes :
 *   - `tone="light"`  : couleur d'origine (cyan sur fond clair)
 *   - `tone="dark"`   : blanc via `brightness-0 invert` pour fonds sombres
 *   - `tone="auto"`   : suit `data-theme` (Navbar) — cyan en clair, blanc en sombre
 *
 * `height` est fixe en `h-*` pour préserver le ratio du PNG ; `maxWidth` est
 * appliqué en `max-w-*` pour éviter de déformer sur les viewports étroits.
 * `priority` passe en `loading="eager"` (LCP-friendly pour le hero/nav).
 */
import Image from 'next/image';

type Tone = 'light' | 'dark' | 'auto';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<Size, { h: string; max: string }> = {
  sm: { h: 'h-7',  max: 'max-w-[140px]' },
  md: { h: 'h-9',  max: 'max-w-[180px]' },
  lg: { h: 'h-12', max: 'max-w-[240px]' },
  xl: { h: 'h-16', max: 'max-w-[320px]' },
};

export interface BrandLogoProps {
  /** Hauteur du logo (largeur dérivée du ratio 2986/1423 ≈ 2.1:1). */
  size?: Size;
  /** Mode d'affichage : 'light' (couleurs d'origine), 'dark' (blanc), 'auto' (thème). */
  tone?: Tone;
  /** Affichage prioritaire (LCP) — désactive le lazy load. */
  priority?: boolean;
  /** Texte alternatif pour l'accessibilité. */
  alt?: string;
  className?: string;
}

export default function BrandLogo({
  size = 'md',
  tone = 'light',
  priority = false,
  alt = 'EauMalik — Purification et osmose inverse',
  className = '',
}: BrandLogoProps) {
  const sz = SIZE_CLASS[size];
  // `auto` : cyan en light, blanc en dark via media query CSS.
  // Implémenté avec deux classes data-theme : on cible l'attribut racine.
  const toneClass =
    tone === 'dark'
      ? 'brightness-0 invert'
      : tone === 'auto'
        ? 'dark-mode:invert dark-mode:brightness-0'
        : '';

  return (
    <span className={`inline-flex items-center ${sz.h} ${sz.max} ${className}`}>
      <Image
        src="/logo.png"
        alt={alt}
        width={2986}
        height={1423}
        priority={priority}
        sizes="(max-width: 768px) 140px, 240px"
        className={`${sz.h} w-auto object-contain select-none ${toneClass}`}
        draggable={false}
      />
    </span>
  );
}
