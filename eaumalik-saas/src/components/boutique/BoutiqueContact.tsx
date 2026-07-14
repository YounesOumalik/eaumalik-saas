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
    <section id="contact" className="py-32 px-6 surface-savor">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div className="reveal revealed">
            <span className="text-xs font-bold uppercase tracking-[0.3em] mb-4 block"
                  style={{ color: 'var(--primary)' }}>
              Contactez-nous
            </span>
            <h2 className="font-serif text-4xl md:text-5xl font-normal leading-[0.85] tracking-tighter mb-6 text-heading">
              Parlons de<br />
              votre <em style={{ color: 'var(--primary)' }}>projet</em>
            </h2>
            <p className="font-light leading-relaxed mb-10 text-body">
              Que ce soit pour un système domestique ou une solution industrielle, notre équipe est
              à votre écoute pour vous accompagner.
            </p>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                     style={{ background: 'var(--primary-glow)' }}>
                  <i className="fa-solid fa-phone text-xl" style={{ color: 'var(--primary)' }} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider font-bold text-meta">
                    Téléphone
                  </p>
                  <p className="font-medium text-heading">{theme.company.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                     style={{ background: 'var(--primary-glow)' }}>
                  <i className="fa-solid fa-envelope text-xl" style={{ color: 'var(--primary)' }} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider font-bold text-meta">Email</p>
                  <p className="font-medium text-heading">{theme.company.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                     style={{ background: 'var(--primary-glow)' }}>
                  <i className="fa-brands fa-whatsapp text-xl" style={{ color: 'var(--primary)' }} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider font-bold text-meta">WhatsApp</p>
                  <p className="font-medium text-heading">{theme.company.altPhone}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="reveal revealed">
            <form
              onSubmit={handleSubmit}
              className="surface-card rounded-3xl p-8 border-soft shadow-lg"
            >
              <div className="space-y-5">
                {sector && (
                  <div className="px-4 py-3 rounded-xl pill-themed text-sm">
                    <i className="fa-solid fa-briefcase mr-2" aria-hidden="true" />
                    Secteur pré-rempli : <strong>{sector}</strong>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-meta">
                    Nom complet
                  </label>
                  <input
                    type="text"
                    required
                    name="name"
                    className="input-themed"
                    placeholder="Votre nom"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-meta">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    required
                    name="phone"
                    className="input-themed"
                    placeholder="+212 6XX XXX XXX"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-meta">
                    Sujet
                  </label>
                  <select
                    name="subject"
                    className="input-themed text-meta"
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
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-meta">
                    Message
                  </label>
                  <textarea
                    rows={4}
                    required
                    name="message"
                    className="input-themed resize-none"
                    placeholder="Décrivez votre besoin..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 btn-primary disabled:opacity-60 disabled:cursor-not-allowed text-sm font-bold uppercase tracking-wide"
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