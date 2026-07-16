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

// Tailles ×2.5 par rapport à la version initiale (sm 28px, md 36px, lg 48px, xl 64px).
const SIZE_CLASS: Record<Size, { h: string; max: string }> = {
  sm: { h: 'h-[70px]',  max: 'max-w-[70px]' },
  md: { h: 'h-[90px]',  max: 'max-w-[90px]' },
  lg: { h: 'h-[120px]', max: 'max-w-[120px]' },
  xl: { h: 'h-[160px]', max: 'max-w-[160px]' },
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
        sizes="(max-width: 768px) 90px, 160px"
        className={`${sz.h} w-auto aspect-square object-contain select-none`}
        draggable={false}
      />
    </span>
  );
}
