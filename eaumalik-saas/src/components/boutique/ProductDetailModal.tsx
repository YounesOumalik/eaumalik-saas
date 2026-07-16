'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import type { Product } from '@/types';
import { formatCurrency } from '@/lib/utils';
import Dialog from '@/components/ui/Dialog';
import AddToCartButton from './AddToCartButton';

interface Props {
  product: Product;
  onClose: () => void;
}

/**
 * Modale detail produit : layout 2 colonnes sur desktop.
 *   - Colonne gauche : image produit (object-contain pour ne pas la rogner),
 *     avec le badge categorie en bas et le bouton fermer en haut.
 *   - Colonne droite : titre, prix, description, specifications techniques,
 *     et CTA (Devis + Panier) avec scroll interne si le contenu est long.
 *
 * Sur mobile (< md) : stack vertical — image en haut (pleine largeur),
 * contenu en dessous.
 *
 * Utilise `Dialog` en variante `bare` + `maxHeight="none"` pour preserver la
 * charte visuelle marketing (carte arrondie, fond stone/cream) tout en
 * beneficait du backdrop/overlay unifie de l'application.
 */
export default function ProductDetailModal({ product, onClose }: Props) {
  // Construction des lignes de specs : on tente de parser "Label: valeur".
  const specRows: { label: string; value: string }[] = (() => {
    if (!product.specs || product.specs.length === 0) {
      return [
        { label: 'Categorie', value: product.category },
        { label: 'Reference', value: product.slug },
        { label: 'Stock disponible', value: `${product.stock} unites` },
      ];
    }
    return product.specs.map((line, i) => {
      const idx = line.indexOf(':');
      if (idx > 0 && idx < line.length - 1) {
        return { label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
      }
      return { label: `Caracteristique ${i + 1}`, value: line };
    });
  })();

  return (
    <Dialog
      open={true}
      onClose={onClose}
      variant="bare"
      size="2xl"
      hideCloseButton
      maxHeight="none"
      title={product.name}
    >
      <div className="grid grid-cols-1 md:grid-cols-[45%_55%]">
        {/* ===== Colonne gauche : image produit ===== */}
        <div
          className="relative md:rounded-l-3xl rounded-t-3xl md:rounded-tr-none overflow-hidden bg-black/40"
          style={{ minHeight: '260px' }}
        >
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              width={800}
              height={600}
              className="w-full h-full object-contain"
              sizes="(max-width: 768px) 100vw, 45vw"
              unoptimized
            />
          ) : (
            <div
              className="w-full h-full min-h-[260px] flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--ocean-100), var(--ocean-50))' }}
            >
              <i
                className="fa-solid fa-droplet text-8xl"
                style={{ color: 'var(--primary-light)' }}
                aria-hidden="true"
              />
            </div>
          )}

          {/* Bouton fermer : ancre sur la colonne image */}
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center transition shadow-lg z-10"
            style={{ background: 'rgba(255,255,255,0.92)', color: 'var(--ocean-700)' }}
          >
            <X size={18} aria-hidden="true" />
          </button>

          {/* Badge categorie : bottom-left */}
          <div
            className="absolute bottom-4 left-4 px-4 py-2 rounded-xl z-10"
            style={{ background: 'rgba(255,255,255,0.92)' }}
          >
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: 'var(--ocean-700)' }}
            >
              {product.category}
            </span>
          </div>
        </div>

        {/* ===== Colonne droite : titre + prix + description + specs + CTA ===== */}
        <div className="p-6 md:p-8 flex flex-col md:max-h-[85vh] md:overflow-y-auto">
          <div className="flex items-start justify-between mb-4 gap-4">
            <h2 className="font-serif text-2xl md:text-3xl font-semibold leading-tight text-heading">
              {product.name}
            </h2>
            <span
              className="text-2xl font-bold whitespace-nowrap"
              style={{
                color: product.price_on_request ? 'var(--ocean-600)' : 'var(--primary)',
              }}
            >
              {product.price_on_request ? 'Sur devis' : formatCurrency(product.price)}
            </span>
          </div>

          <p className="leading-relaxed mb-8 text-body">
            {product.description ?? ''}
          </p>

          <h4 className="font-semibold text-sm uppercase tracking-wider mb-3 text-meta">
            Caracteristiques techniques
          </h4>
          <div className="surface-card rounded-2xl p-5 mb-8">
            {specRows.map((row, idx) => (
              <div
                key={`${row.label}-${idx}`}
                className="flex justify-between py-3 border-b border-soft last:border-b-0 gap-4"
              >
                <span className="text-sm text-meta">{row.label}</span>
                <span className="text-sm font-medium text-right max-w-[60%] text-heading">
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-auto flex flex-col sm:flex-row gap-4">
            <a
              href="#contact"
              onClick={e => {
                e.preventDefault();
                onClose();
                document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex-1 py-4 rounded-xl btn-primary text-sm font-bold uppercase tracking-wide text-center"
            >
              Demander un devis
            </a>
            {!product.price_on_request && (
              <AddToCartButton
                product={product}
                size="lg"
                className="flex-1 justify-center"
                requireAuth
              />
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
