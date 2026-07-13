'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/shared/ToastProvider';
import { theme } from '@/theme';

const SUBJECTS = [
  'Demande de devis catalogue',
  'Produit industriel',
  'Installation & maintenance',
  'Partenariat',
  'Autre',
];

/**
 * Section Contact + formulaire de devis pour les secteurs industriels.
 * Reçoit via CustomEvent `boutique:open-quote` (déclenché par BoutiqueIndustrial)
 * un secteur pré-rempli.
 */
export default function BoutiqueContact() {
  const toast = useToast();
  const [sector, setSector] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ sector: string }>).detail;
      setSector(detail.sector);
      // Scroll doux vers le formulaire
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.addEventListener('boutique:open-quote', handler);
    return () => window.removeEventListener('boutique:open-quote', handler);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    // Simule un envoi (à brancher sur l'API plus tard si besoin)
    await new Promise(r => setTimeout(r, 600));
    setSubmitting(false);
    (e.target as HTMLFormElement).reset();
    setSector('');
    toast('Message envoyé avec succès !', 'success');
  };

  return (
    <section id="contact" className="py-32 px-6 bg-stone-50">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div className="reveal revealed">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-brand-600 mb-4 block">
              Contactez-nous
            </span>
            <h2 className="font-serif text-4xl md:text-5xl font-normal leading-[0.85] tracking-tighter mb-6 text-stone-900">
              Parlons de<br />
              votre <em className="text-brand-700">projet</em>
            </h2>
            <p className="text-stone-500 font-light leading-relaxed mb-10">
              Que ce soit pour un système domestique ou une solution industrielle, notre équipe est
              à votre écoute pour vous accompagner.
            </p>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center">
                  <i className="fa-solid fa-phone text-xl text-brand-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wider font-bold">
                    Téléphone
                  </p>
                  <p className="font-medium text-stone-900">{theme.company.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center">
                  <i className="fa-solid fa-envelope text-xl text-brand-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wider font-bold">Email</p>
                  <p className="font-medium text-stone-900">{theme.company.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center">
                  <i className="fa-brands fa-whatsapp text-xl text-brand-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wider font-bold">WhatsApp</p>
                  <p className="font-medium text-stone-900">{theme.company.altPhone}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="reveal revealed">
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-3xl p-8 border border-stone-100 shadow-lg"
            >
              <div className="space-y-5">
                {sector && (
                  <div className="px-4 py-3 rounded-xl bg-brand-50 border border-brand-100 text-sm text-brand-700">
                    <i className="fa-solid fa-briefcase mr-2" aria-hidden="true" />
                    Secteur pré-rempli : <strong>{sector}</strong>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                    Nom complet
                  </label>
                  <input
                    type="text"
                    required
                    name="name"
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
                    placeholder="Votre nom"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    required
                    name="phone"
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
                    placeholder="+212 6XX XXX XXX"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                    Sujet
                  </label>
                  <select
                    name="subject"
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition text-stone-500"
                    defaultValue={SUBJECTS[0]}
                  >
                    {SUBJECTS.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                    Message
                  </label>
                  <textarea
                    rows={4}
                    required
                    name="message"
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition resize-none"
                    placeholder="Décrivez votre besoin..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold uppercase tracking-wide transition-all duration-300 hover:shadow-[0_0_20px_rgba(20,184,166,0.3)]"
                >
                  {submitting ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin mr-2" aria-hidden="true" />
                      Envoi en cours...
                    </>
                  ) : (
                    'Envoyer la demande'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}