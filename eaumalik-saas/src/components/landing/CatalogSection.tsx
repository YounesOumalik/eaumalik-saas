'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { X, Droplets, CheckCircle2, ArrowRight } from 'lucide-react';
import type { Product, ProductCategory } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { submitPublicInquiryAction } from '@/app/actions/contactActions';

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  purificateurs: 'Purificateurs',
  industriel: 'Industriel',
  consommables: 'Consommables',
};

export default function CatalogSection({ products }: { products: Product[] }) {
  const [activeCat, setActiveCat] = useState<string>('Tous');
  const [selected, setSelected] = useState<Product | null>(null);
  const [devisMode, setDevisMode] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const categories = ['Tous', ...Array.from(new Set(products.map((p) => p.category)))];

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelected(null);
        setDevisMode(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const matches = (p: Product) => activeCat === 'Tous' || p.category === activeCat;

  function openProduct(p: Product) {
    setSelected(p);
    setDevisMode(false);
    setForm({ name: '', phone: '', email: '', message: `Demande de devis pour : ${p.name}` });
  }

  async function submitDevis(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    const res = await submitPublicInquiryAction({
      name: form.name,
      phone: form.phone,
      email: form.email,
      subject: 'Demande de devis',
      message: form.message || `Demande de devis pour ${selected.name}`,
    });
    setSubmitting(false);
    if (res.success) {
      setToast('Demande envoyée ! Notre équipe vous recontacte rapidement.');
      setSelected(null);
      setDevisMode(false);
    } else {
      setToast(res.error || "Erreur lors de l'envoi.");
    }
  }

  return (
    <section id="catalogue" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-100 text-brand-700 text-xs font-bold uppercase tracking-[0.3em] mb-4">
            <Droplets className="w-4 h-4" /> Notre gamme
          </div>
          <h2 className="font-serif text-4xl md:text-6xl text-stone-900 mb-4">Catalogue Produits</h2>
          <p className="text-stone-600 max-w-2xl mx-auto">
            Filtres, osmoseurs, fontaines et consommables — sélectionnez une catégorie pour explorer nos solutions.
          </p>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={`cat-btn px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 border border-stone-200 ${
                activeCat === cat ? 'active' : 'bg-white text-stone-600 hover:border-brand-300'
              }`}
            >
              {cat === 'Tous' ? 'Tous' : CATEGORY_LABELS[cat as ProductCategory]}
            </button>
          ))}
        </div>

        {/* Grille produits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((p) => (
            <div
              key={p.id}
              className={`product-card ${matches(p) ? 'show-card' : 'hidden-card'}`}
            >
              <button
                onClick={() => openProduct(p)}
                className="group block w-full text-left bg-cream rounded-3xl overflow-hidden border border-stone-100 hover:shadow-xl transition-all duration-300"
              >
                <div className="aspect-square bg-savor relative overflow-hidden">
                  {p.image_url ? (
                    <Image
                      src={p.image_url}
                      alt={p.name}
                      fill
                      unoptimized
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-brand-300">
                      <Droplets className="w-16 h-16" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                    {CATEGORY_LABELS[p.category]}
                  </span>
                  <h3 className="font-serif text-lg text-stone-900 mt-1 mb-3 leading-snug">{p.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-brand-600 font-bold text-lg">{formatCurrency(p.price)}</span>
                    <span className="text-stone-400 text-sm flex items-center gap-1 group-hover:text-brand-500 transition-colors">
                      Détails <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal produit / devis */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm"
          onClick={() => {
            setSelected(null);
            setDevisMode(false);
          }}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setSelected(null);
                setDevisMode(false);
              }}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>

            {!devisMode ? (
              <div className="grid md:grid-cols-2">
                <div className="aspect-square bg-savor relative">
                  {selected.image_url ? (
                    <Image src={selected.image_url} alt={selected.name} fill unoptimized className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-brand-300">
                      <Droplets className="w-20 h-20" />
                    </div>
                  )}
                </div>
                <div className="p-7">
                  <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                    {CATEGORY_LABELS[selected.category]}
                  </span>
                  <h3 className="font-serif text-2xl text-stone-900 mt-1 mb-3">{selected.name}</h3>
                  <div className="text-brand-600 font-bold text-2xl mb-4">{formatCurrency(selected.price)}</div>
                  {selected.description && (
                    <p className="text-stone-600 text-sm leading-relaxed mb-4">{selected.description}</p>
                  )}
                  {selected.specs && selected.specs.length > 0 && (
                    <ul className="space-y-1.5 mb-6">
                      {selected.specs.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                          <CheckCircle2 className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    onClick={() => setDevisMode(true)}
                    className="w-full py-3.5 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl text-sm font-bold uppercase tracking-wide transition-colors"
                  >
                    Demander un devis
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submitDevis} className="p-7">
                <h3 className="font-serif text-2xl text-stone-900 mb-1">Demande de devis</h3>
                <p className="text-stone-500 text-sm mb-5">{selected.name}</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Nom complet *</label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                      placeholder="Votre nom"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Téléphone *</label>
                    <input
                      required
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                      placeholder="06 12 34 56 78"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Email (optionnel)</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                      placeholder="vous@exemple.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Message</label>
                    <textarea
                      rows={3}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setDevisMode(false)}
                    className="px-5 py-3 rounded-2xl border border-stone-200 text-stone-600 text-sm font-semibold hover:bg-stone-50"
                  >
                    Retour
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white rounded-2xl text-sm font-bold uppercase tracking-wide transition-colors"
                  >
                    {submitting ? 'Envoi…' : 'Envoyer la demande'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-lg animate-toast-in">
          <CheckCircle2 className="w-5 h-5 text-brand-400" />
          {toast}
        </div>
      )}
    </section>
  );
}
