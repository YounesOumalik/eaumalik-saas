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
    <section id="contact" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-100 text-brand-700 text-xs font-bold uppercase tracking-[0.3em] mb-4">
            <i className="fa-solid fa-headset" /> Contact
          </div>
          <h2 className="font-serif text-4xl md:text-6xl text-stone-900 mb-4">Parlons de votre projet</h2>
          <p className="text-stone-600 max-w-2xl mx-auto">
            Une question, un devis, un besoin spécifique ? Écrivez-nous, notre équipe vous répond sous 24h.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Coordonnées */}
          <div className="space-y-6">
            <a href="tel:+212600000000" className="flex items-center gap-4 p-5 rounded-2xl bg-cream border border-stone-100 hover:border-brand-300 transition-colors">
              <span className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 text-xl">
                <i className="fa-solid fa-phone" />
              </span>
              <div>
                <div className="text-sm text-stone-500">Téléphone</div>
                <div className="font-semibold text-stone-900">+212 6 00 00 00 00</div>
              </div>
            </a>
            <a href="mailto:contact@eaumalik.ma" className="flex items-center gap-4 p-5 rounded-2xl bg-cream border border-stone-100 hover:border-brand-300 transition-colors">
              <span className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 text-xl">
                <i className="fa-solid fa-envelope" />
              </span>
              <div>
                <div className="text-sm text-stone-500">Email</div>
                <div className="font-semibold text-stone-900">contact@eaumalik.ma</div>
              </div>
            </a>
            <a href="https://wa.me/212600000000" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-5 rounded-2xl bg-cream border border-stone-100 hover:border-brand-300 transition-colors">
              <span className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 text-xl">
                <i className="fa-brands fa-whatsapp" />
              </span>
              <div>
                <div className="text-sm text-stone-500">WhatsApp</div>
                <div className="font-semibold text-stone-900">Écrivez-nous directement</div>
              </div>
            </a>
          </div>

          {/* Formulaire */}
          <form onSubmit={submit} className="bg-cream rounded-3xl p-7 border border-stone-100 space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Nom complet *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none" placeholder="Votre nom" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Téléphone *</label>
              <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none" placeholder="06 12 34 56 78" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Sujet</label>
              <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none bg-white">
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Message *</label>
              <textarea required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none resize-none" placeholder="Votre message…" />
            </div>
            <button type="submit" disabled={submitting} className="w-full py-3.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white rounded-2xl text-sm font-bold uppercase tracking-wide transition-colors">
              {submitting ? 'Envoi…' : 'Envoyer le message'}
            </button>
          </form>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-lg animate-toast-in">
          <CheckCircle2 className="w-5 h-5 text-brand-400" />
          {toast}
        </div>
      )}
    </section>
  );
}
