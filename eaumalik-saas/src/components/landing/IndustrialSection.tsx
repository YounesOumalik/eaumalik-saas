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
    <section id="industriel" className="py-24 surface-cream">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full pill-themed text-xs font-bold uppercase tracking-[0.3em] mb-4">
            <Factory className="w-4 h-4" /> Solutions Pro
          </div>
          <h2 className="font-serif text-4xl md:text-6xl mb-4 text-heading">EauMalik pour les Professionnels</h2>
          <p className="max-w-2xl mx-auto text-body">
            Des solutions sur mesure pour chaque secteur. Négociez vos volumes et bénéficiez d’un accompagnement dédié.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SECTORS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="surface-card rounded-3xl p-7 hover:shadow-xl transition-all duration-300 group">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-colors"
                  style={{ background: 'var(--primary-glow)' }}
                >
                  <Icon className="w-7 h-7" style={{ color: 'var(--primary)' }} />
                </div>
                <h3 className="font-serif text-xl text-heading mb-2">{s.title}</h3>
                <p className="text-sm leading-relaxed mb-5 text-body">{s.desc}</p>
                <button
                  onClick={() => openNegotiation(s.title)}
                  className="font-semibold text-sm transition-colors hover:opacity-80"
                  style={{ color: 'var(--primary)' }}
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
              <div key={t.label} className="flex items-center gap-3 surface-card rounded-2xl px-5 py-4">
                <Icon className="w-6 h-6 shrink-0" style={{ color: 'var(--primary)' }} />
                <span className="text-sm font-medium text-body">{t.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal négociation */}
      {sector && (
        <div
          className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setSector(null)}
        >
          <div
            className="modal-surface rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-7 animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSector(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center surface-solid border-soft"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-serif text-2xl text-heading mb-1">Devis professionnel</h3>
            <p className="text-sm font-semibold mb-5" style={{ color: 'var(--primary)' }}>{sector}</p>

            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nom *</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-themed" placeholder="Votre nom" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Société *</label>
                  <input required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="input-themed" placeholder="Raison sociale" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Téléphone *</label>
                  <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-themed" placeholder="06 12 34 56 78" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-themed" placeholder="vous@exemple.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Volume estimé</label>
                <input value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} className="input-themed" placeholder="Ex : 500 L/jour" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Détails</label>
                <textarea rows={3} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} className="input-themed resize-none" placeholder="Besoins spécifiques…" />
              </div>
              <button type="submit" disabled={submitting} className="w-full py-3.5 btn-primary disabled:opacity-60 text-sm font-bold uppercase tracking-wide">
                {submitting ? 'Envoi…' : 'Envoyer la demande'}
              </button>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg animate-toast-in surface-solid border-soft">
          <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--primary)' }} />
          <span style={{ color: 'var(--text)' }}>{toast}</span>
        </div>
      )}
    </section>
  );
}
