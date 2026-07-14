/**
 * BrandLogo — rendu de l'identité visuelle d'EAUMALIK.
 *
 * Source unique : `/public/logo.png` (1440×1440, version brute du JPEG
 * `Produits/Logo Eaumalik.jpeg` — fond noir + goutte bleue + mot-symbole
 * "EauMalik"). Variante HiDPI : `/public/logo@2x.png` (2880×2880).
 *
 * Le logo est utilisé TEL QUEL : pas de recolorisation, pas d'invert en
 * thème sombre (le fond noir est partie intégrante de l'identité).
 * On adapte uniquement les dimensions d'affichage via les classes
 * `h-*`/`max-w-*` (le ratio 1:1 est préservé par `object-contain`).
 *
 * `height` est fixe en `h-*` ; `maxWidth` limite la largeur pour ne pas
 * déborder sur les viewports étroits.
 * `priority` passe en `loading="eager"` (LCP-friendly pour le hero/nav).
 */
import Image from 'next/image';

type Size = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<Size, { h: string; max: string }> = {
  sm: { h: 'h-7',  max: 'max-w-[28px]' },
  md: { h: 'h-9',  max: 'max-w-[36px]' },
  lg: { h: 'h-12', max: 'max-w-[48px]' },
  xl: { h: 'h-16', max: 'max-w-[64px]' },
};

export interface BrandLogoProps {
  /** Hauteur du logo (carré 1:1, largeur dérivée). */
  size?: Size;
  /** Affichage prioritaire (LCP) — désactive le lazy load. */
  priority?: boolean;
  /** Texte alternatif pour l'accessibilité. */
  alt?: string;
  className?: string;
}

export default function BrandLogo({
  size = 'md',
  priority = false,
  alt = "EauMalik — Captage, traitement et distribution d'eau",
  className = '',
}: BrandLogoProps) {
  const sz = SIZE_CLASS[size];

  return (
    <span className={`inline-flex items-center ${sz.h} ${sz.max} ${className}`}>
      <Image
        src="/logo.png"
        alt={alt}
        width={1440}
        height={1440}
        priority={priority}
        sizes="(max-width: 768px) 36px, 48px"
        className={`${sz.h} w-auto aspect-square object-contain select-none`}
        draggable={false}
      />
    </span>
  );
}
