'use client';

import { useEffect, useState } from 'react';
import { Factory, Building2, Hospital, School, Utensils, Building, Truck, ShieldCheck, Wrench, Headphones, X, CheckCircle2 } from 'lucide-react';
import { submitPublicInquiryAction } from '@/app/actions/contactActions';

const SECTORS = [
  { icon: Factory, title: 'Usines & Industrie', desc: 'Traitement d’eau industrielle, refroidissement et process.' },
  { icon: Building2, title: 'Hôtellerie & Restauration', desc: 'Solutions pour hôtels, restaurants et cafés.' },
  { icon: Hospital, title: 'Santé & Cliniques', desc: 'Eau purifiée pour établissements de santé.' },
  { icon: School, title: 'Éducation & Collectivités', desc: 'Écoles, universités et espaces publics.' },
  { icon: Utensils, title: 'Agroalimentaire', desc: 'Eau process et lavage pour l’agro-industrie.' },
  { icon: Building, title: 'Résidences & Copropriétés', desc: 'Stations communes et distribution centralisée.' },
];

const TRUST = [
  { icon: Truck, label: 'Livraison & installation' },
  { icon: ShieldCheck, label: 'Garantie jusqu’à 5 ans' },
  { icon: Wrench, label: 'Maintenance préventive' },
  { icon: Headphones, label: 'Support 7j/7' },
];

export default function IndustrialSection() {
  const [sector, setSector] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', company: '', phone: '', email: '', volume: '', details: '' });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSector(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function openNegotiation(s: string) {
    setSector(s);
    setForm({ name: '', company: '', phone: '', email: '', volume: '', details: '' });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sector) return;
    setSubmitting(true);
    const res = await submitPublicInquiryAction({
      name: form.name,
      phone: form.phone,
      email: form.email,
      sector,
      company: form.company,
      volume: form.volume,
      subject: 'Devis professionnel',
      message: form.details || `Demande de devis professionnel — secteur : ${sector}`,
    });
    setSubmitting(false);
    if (res.success) {
      setToast('Votre demande pro a été envoyée ! Nous vous recontactons.');
      setSector(null);
    } else {
      setToast(res.error || "Erreur lors de l'envoi.");
    }
  }

  return (
    <section id="industriel" className="py-24 bg-cream">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-100 text-brand-700 text-xs font-bold uppercase tracking-[0.3em] mb-4">
            <Factory className="w-4 h-4" /> Solutions Pro
          </div>
          <h2 className="font-serif text-4xl md:text-6xl text-stone-900 mb-4">EauMalik pour les Professionnels</h2>
          <p className="text-stone-600 max-w-2xl mx-auto">
            Des solutions sur mesure pour chaque secteur. Négociez vos volumes et bénéficiez d’un accompagnement dédié.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SECTORS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="bg-white rounded-3xl p-7 border border-stone-100 hover:shadow-xl transition-all duration-300 group">
                <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mb-5 group-hover:bg-brand-100 transition-colors">
                  <Icon className="w-7 h-7 text-brand-600" />
                </div>
                <h3 className="font-serif text-xl text-stone-900 mb-2">{s.title}</h3>
                <p className="text-stone-600 text-sm leading-relaxed mb-5">{s.desc}</p>
                <button
                  onClick={() => openNegotiation(s.title)}
                  className="text-brand-600 font-semibold text-sm hover:text-brand-700 transition-colors"
                >
                  Négocier →
                </button>
              </div>
            );
          })}
        </div>

        {/* Badges de confiance */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
          {TRUST.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.label} className="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 border border-stone-100">
                <Icon className="w-6 h-6 text-brand-600 shrink-0" />
                <span className="text-sm font-medium text-stone-700">{t.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal négociation */}
      {sector && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm"
          onClick={() => setSector(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-7 animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSector(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-serif text-2xl text-stone-900 mb-1">Devis professionnel</h3>
            <p className="text-brand-600 text-sm font-semibold mb-5">{sector}</p>

            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Nom *</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none" placeholder="Votre nom" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Société *</label>
                  <input required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none" placeholder="Raison sociale" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Téléphone *</label>
                  <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none" placeholder="06 12 34 56 78" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none" placeholder="vous@exemple.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Volume estimé</label>
                <input value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none" placeholder="Ex : 500 L/jour" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Détails</label>
                <textarea rows={3} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none resize-none" placeholder="Besoins spécifiques…" />
              </div>
              <button type="submit" disabled={submitting} className="w-full py-3.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white rounded-2xl text-sm font-bold uppercase tracking-wide transition-colors">
                {submitting ? 'Envoi…' : 'Envoyer la demande'}
              </button>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-lg animate-toast-in">
          <CheckCircle2 className="w-5 h-5 text-brand-400" />
          {toast}
        </div>
      )}
    </section>
  );
}
