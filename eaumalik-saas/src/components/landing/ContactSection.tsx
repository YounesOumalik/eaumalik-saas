'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { submitPublicInquiryAction } from '@/app/actions/contactActions';

const SUBJECTS = [
  'Question générale',
  'Demande de devis',
  'Support technique',
  'Autre',
];

export default function ContactSection() {
  const [form, setForm] = useState({ name: '', phone: '', subject: SUBJECTS[0], message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await submitPublicInquiryAction({
      name: form.name,
      phone: form.phone,
      subject: form.subject,
      message: form.message,
    });
    setSubmitting(false);
    if (res.success) {
      setToast('Message envoyé ! Nous vous répondons très vite.');
      setForm({ name: '', phone: '', subject: SUBJECTS[0], message: '' });
    } else {
      setToast(res.error || "Erreur lors de l'envoi.");
    }
  }

  return (
    <section id="contact" className="py-24 surface-page">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full pill-themed text-xs font-bold uppercase tracking-[0.3em] mb-4">
            <i className="fa-solid fa-headset" /> Contact
          </div>
          <h2 className="font-serif text-4xl md:text-6xl mb-4 text-heading">Parlons de votre projet</h2>
          <p className="max-w-2xl mx-auto text-body">
            Une question, un devis, un besoin spécifique ? Écrivez-nous, notre équipe vous répond sous 24h.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Coordonnées */}
          <div className="space-y-6">
            <a href="tel:+212661463194" className="flex items-center gap-4 p-5 rounded-2xl border-soft surface-savor hover:opacity-90 transition-colors">
              <span className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: 'var(--primary-glow)', color: 'var(--primary)' }}>
                <i className="fa-solid fa-phone" />
              </span>
              <div>
                <div className="text-sm text-meta">Téléphone</div>
                <div className="font-semibold text-heading">+212 661 463 194</div>
              </div>
            </a>
            <a href="mailto:eaumaliksarl@gmail.com" className="flex items-center gap-4 p-5 rounded-2xl border-soft surface-savor hover:opacity-90 transition-colors">
              <span className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: 'var(--primary-glow)', color: 'var(--primary)' }}>
                <i className="fa-solid fa-envelope" />
              </span>
              <div>
                <div className="text-sm text-meta">Email</div>
                <div className="font-semibold text-heading">eaumaliksarl@gmail.com</div>
              </div>
            </a>
            <a href="https://wa.me/212661463194" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-5 rounded-2xl border-soft surface-savor hover:opacity-90 transition-colors">
              <span className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: 'var(--primary-glow)', color: 'var(--primary)' }}>
                <i className="fa-brands fa-whatsapp" />
              </span>
              <div>
                <div className="text-sm text-meta">WhatsApp</div>
                <div className="font-semibold text-heading">Écrivez-nous directement</div>
              </div>
            </a>
          </div>

          {/* Formulaire */}
          <form onSubmit={submit} className="surface-savor rounded-3xl p-7 border-soft space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nom complet *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-themed" placeholder="Votre nom" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Téléphone *</label>
              <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-themed" placeholder="06 12 34 56 78" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Sujet</label>
              <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input-themed">
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Message *</label>
              <textarea required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="input-themed resize-none" placeholder="Votre message…" />
            </div>
            <button type="submit" disabled={submitting} className="w-full py-3.5 btn-primary disabled:opacity-60 text-sm font-bold uppercase tracking-wide">
              {submitting ? 'Envoi…' : 'Envoyer le message'}
            </button>
          </form>
        </div>

        {/* Carte Google Maps — 23 Rue Boured Eig 3, N5 Roches Noires, Casablanca */}
        <div className="mt-14">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full pill-themed text-[10px] font-bold uppercase tracking-[0.25em] mb-3">
              <i className="fa-solid fa-location-dot" /> Localisation
            </div>
            <h3 className="font-serif text-2xl md:text-3xl mb-2 text-heading">Notre adresse</h3>
            <p className="text-body">23 Rue Boured Eig 3, N5 Roches Noires, Casablanca</p>
          </div>
          <div
            className="relative w-full overflow-hidden rounded-3xl border-soft shadow-xl"
            style={{ height: '420px' }}
          >
            <iframe
              src="https://maps.google.com/maps?q=33.6021644,-7.5832744&hl=fr&z=16&ie=UTF8&iwloc=&output=embed"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Localisation EAUMALIK — 23 Rue Boured Eig 3, N5 Roches Noires, Casablanca"
              className="absolute inset-0"
            />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://www.google.com/maps/dir/?api=1&destination=33.6021644,-7.5832744"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border-soft surface-savor hover:opacity-90 transition-colors"
              style={{ color: 'var(--primary)' }}
            >
              <i className="fa-solid fa-route" /> Obtenir l&apos;itinéraire
            </a>
            <a
              href="https://www.google.com/maps/search/?api=1&query=33.6021644,-7.5832744"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border-soft surface-savor hover:opacity-90 transition-colors"
              style={{ color: 'var(--primary)' }}
            >
              <i className="fa-solid fa-map" /> Ouvrir dans Google Maps
            </a>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg animate-toast-in surface-solid border-soft">
          <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--primary)' }} />
          <span style={{ color: 'var(--text)' }}>{toast}</span>
        </div>
      )}
    </section>
  );
}
