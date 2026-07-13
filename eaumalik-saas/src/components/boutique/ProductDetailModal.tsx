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
 * Modale detail produit : image hero en haut, specifications dans un tableau
 * arrondi, CTA principal "Demander un devis" + "Ajouter au panier".
 *
 * Utilise `Dialog` en variante `bare` pour preserver la charte visuelle
 * marketing (image plein largeur, couleurs stone/cream) tout en beneficiaient
 * du backdrop/overlay unifie de l'application (meme `modal-overlay` que
 * toutes les autres modales de l'app).
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
      size="xl"
      hideCloseButton
      title={product.name}
    >
      <div className="relative">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            width={800}
            height={500}
            className="w-full h-64 md:h-80 object-cover rounded-t-3xl"
            unoptimized
          />
        ) : (
          <div className="w-full h-64 md:h-80 rounded-t-3xl bg-gradient-to-br from-brand-100 to-cyan-100 flex items-center justify-center">
            <i className="fa-solid fa-droplet text-8xl text-brand-400" aria-hidden="true" />
          </div>
        )}

        {/* Bouton fermer specifique boutique : style flottant blanc,
            inherent a la charte marketing produit */}
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition shadow-lg"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="absolute bottom-4 left-4 px-4 py-2 rounded-xl bg-white/90 backdrop-blur-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
            {product.category}
          </span>
        </div>
      </div>

      <div className="p-8">
        <div className="flex items-start justify-between mb-4 gap-4">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold leading-tight text-stone-900">
            {product.name}
          </h2>
          <span className="text-2xl font-bold text-brand-700 whitespace-nowrap">
            {formatCurrency(product.price)}
          </span>
        </div>

        <p className="text-stone-500 leading-relaxed mb-8">
          {product.description ?? ''}
        </p>

        <h4 className="font-semibold text-sm uppercase tracking-wider text-stone-500 mb-3">
          Caracteristiques techniques
        </h4>
        <div className="bg-stone-50 rounded-2xl p-5">
          {specRows.map((row, idx) => (
            <div
              key={`${row.label}-${idx}`}
              className="flex justify-between py-3 border-b border-stone-100 last:border-b-0 gap-4"
            >
              <span className="text-sm text-stone-500">{row.label}</span>
              <span className="text-sm font-medium text-right max-w-[60%] text-stone-900">
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <a
            href="#contact"
            onClick={e => {
              e.preventDefault();
              onClose();
              document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex-1 py-4 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-bold uppercase tracking-wide text-center transition"
          >
            Demander un devis
          </a>
          <AddToCartButton product={product} size="lg" className="flex-1 justify-center" />
        </div>
      </div>
    </Dialog>
  );
}
