'use client';

import { Phone, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { maybeSupabaseBrowserClient } from '@/lib/supabase/client';
import { PHONE_MA_REGEX } from '@/lib/utils';
import SearchableCitySelect from '@/components/shared/SearchableCitySelect';
import BrandLogo from '@/components/shared/BrandLogo';

export default function GoogleCompletePage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center">Chargement…</div>}>
      <GoogleCompleteInner />
    </Suspense>
  );
}

function GoogleCompleteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/client';

  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!PHONE_MA_REGEX.test(phone)) {
      setError('Numéro de téléphone invalide (ex: 0XXXXXXXXX).');
      return;
    }
    if (!city) {
      setError('La ville est obligatoire.');
      return;
    }

    setLoading(true);
    try {
      const supabase = maybeSupabaseBrowserClient();
      if (!supabase) throw new Error('Supabase manquant');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');

      const { error: updateErr } = await supabase
        .from('users')
        .update({ phone, city })
        .eq('id', user.id);

      if (updateErr) throw updateErr;

      setSuccess('Profil complété avec succès !');
      setTimeout(() => router.push(callbackUrl), 1500);
    } catch (err) {
      setError((err as Error).message || 'Erreur lors de la mise à jour.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="glass-card p-8 max-w-md w-full">
        <div className="mb-6 flex justify-center">
          <BrandLogo size="lg" priority />
        </div>
        <h1 className="font-display font-extrabold text-2xl mb-2 text-center">
          Compléter votre <span className="gradient-text">profil</span>
        </h1>
        <p className="text-sm mb-6 text-center" style={{ color: 'var(--text-secondary)' }}>
          Pour finaliser votre inscription et recevoir vos alertes, nous avons besoin de votre numéro et ville.
        </p>

        {error && (
          <div className="p-3 mb-4 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 mb-4 rounded-lg text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
            <CheckCircle2 size={14} /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label text-left flex items-center gap-1.5"><Phone size={12} /> Numéro de téléphone *</label>
            <input type="tel" required className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="06XXXXXXXX" />
          </div>
          <div>
            <label className="form-label text-left flex items-center gap-1.5"><MapPin size={12} /> Ville *</label>
            <SearchableCitySelect value={city} onChange={setCity} placeholder="Choisir une ville" required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={16} /> : 'Finaliser mon inscription'}
          </button>
        </form>
      </div>
    </div>
  );
}
