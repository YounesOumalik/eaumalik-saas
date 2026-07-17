'use client';

import { Phone, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { maybeSupabaseBrowserClient } from '@/lib/supabase/client';
import { PHONE_MA_REGEX } from '@/lib/utils';
import SearchableCitySelect from '@/components/shared/SearchableCitySelect';
import BrandLogo from '@/components/shared/BrandLogo';

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

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
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Au montage : récupère la session Google active et redirige vers /login
  // s'il n'y en a pas (ex: URL accédée manuellement ou état perdu). Cela
  // clarifie pour l'utilisateur que la connexion Google vient d'avoir lieu.
  useEffect(() => {
    const supabase = maybeSupabaseBrowserClient();
    if (!supabase) {
      setError('Configuration Supabase manquante.');
      setChecking(false);
      return;
    }
    let cancelled = false;

    // Supprimé : le timeout de 10s n'est plus nécessaire car la session est
    // maintenant posée par le serveur (/api/auth/callback) AVANT que cette
    // page ne soit montée. getUser() résout immédiatement.

    supabase.auth.getUser().then(async ({ data }) => {
      const user = data?.user;
      if (cancelled) return;
      if (!user) {
        // Pas de session Google valide — on renvoie à /login proprement.
        router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
        return;
      }
      setGoogleEmail(user.email ?? null);

      // On lit la table `users` (source de vérité) plutôt que user_metadata,
      // qui peut être en retard après un update.
      const { data: row } = await supabase
        .from('users')
        .select('phone, city')
        .eq('id', user.id)
        .single();
      if (cancelled) return;
      setPhone(row?.phone || (user.user_metadata?.phone as string) || '');
      setCity(row?.city || (user.user_metadata?.city as string) || '');

      // Auto-skip : si l'user a DÉJÀ un profil complet (phone + ville en base),
      // on le redirige directement vers callbackUrl.
      // On utilise window.location.replace pour forcer un full reload
      // (le middleware + RSC doivent s'exécuter avec la session fraîche).
      if (row?.phone && row?.city) {
        const target = callbackUrl.startsWith('/') ? callbackUrl : '/client';
        window.location.replace(target);
        return;
      }

      setChecking(false);
    });
    return () => { cancelled = true; };
  }, [router, callbackUrl]);

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

      // Persiste aussi dans user_metadata pour que les prochaines lectures
      // (et la session JWT) voient les nouvelles valeurs immédiatement,
      // sans dépendre d'un éventuel cache RLS.
      await supabase.auth.updateUser({
        data: { phone, city },
      });

      setSuccess('Profil complété avec succès !');

      // On force un rechargement complet de la page cible via
      // window.location.replace (et NON router.replace). Pourquoi :
      //  1. router.replace() + router.refresh() dans la même tick est
      //     fragile — le refresh peut s'exécuter avant la navigation.
      //  2. Un full reload garantit que le middleware Next.js re-s'exécute
      //     avec les cookies de session à jour, que les RSC sont régénérés,
      //     et que le CartProvider lit le panier depuis le bon storage.
      //  3. Sans full reload, `useSupabaseAuth().session` peut être null au
      //     premier rendu de la page `/panier` → celle-ci redirige vers
      //     /login → boucle infinie.
      const target = callbackUrl.startsWith('/') ? callbackUrl : '/client';
      window.location.replace(target);
    } catch (err) {
      setError((err as Error).message || 'Erreur lors de la mise à jour.');
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="animate-spin" size={28} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="glass-card p-8 max-w-md w-full">
        <div className="mb-6 flex justify-center">
          <BrandLogo size="lg" priority />
        </div>

        {/* Bandeau "Connecté avec Google" : clarifie que l'auth Google vient
            d'avoir lieu et que l'utilisateur voit maintenant la dernière étape
            (compléter profil) — corrige la sensation de "rien ne se passe". */}
        {googleEmail && (
          <div
            className="mb-5 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{
              background: 'rgba(52, 168, 83, 0.08)',
              border: '1px solid rgba(52, 168, 83, 0.25)',
              color: '#15803d',
            }}
          >
            <CheckCircle2 size={14} />
            <span className="flex items-center gap-1.5">
              <GoogleIcon />
              <span>
                Connecté avec Google en tant que{' '}
                <strong>{googleEmail}</strong>
              </span>
            </span>
          </div>
        )}

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
