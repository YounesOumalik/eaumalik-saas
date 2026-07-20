'use client';

import { Phone, MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { maybeSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSupabaseAuth } from '@/components/shared/SupabaseAuthProvider';
import { PHONE_MA_REGEX } from '@/lib/utils';
import SearchableCitySelect from '@/components/shared/SearchableCitySelect';
import BrandLogo from '@/components/shared/BrandLogo';
import { safeCallbackPath, safePostLoginLanding } from '@/lib/navigation';

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
  const callbackUrl = safePostLoginLanding(searchParams.get('callbackUrl'));
  const { user, loading: authLoading } = useSupabaseAuth();
  // Un seul client pour tout le cycle de vie du composant : eviter qu'un
  // deuxieme createBrowserClient (avec son propre cookie-parser) relise les
  // cookies avant qu'ils soient attaches au document, ce qui ferait
  // auth.getUser() renvoyer null meme apres un login Google reussi.
  const supabase = useMemo(() => maybeSupabaseBrowserClient(), []);

  const [submitting, setSubmitting] = useState(false);
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profileChecked, setProfileChecked] = useState(false);
  const redirectedRef = useRef(false);

  // The callback route has already exchanged the OAuth code and attached the
  // session cookies before this page is rendered. This page only decides
  // whether the profile needs completion.
  useEffect(() => {
    if (redirectedRef.current) return;
    if (authLoading) return;
    if (!user) {
      redirectedRef.current = true;
      router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }

    if (!supabase) {
      setError('Configuration Supabase manquante.');
      setProfileChecked(true);
      return;
    }

    void (async () => {
      try {
        const { data: row, error: profileError } = await supabase
          .from('users')
          .select('phone, city')
          .eq('id', user.id)
          .single();
        if (redirectedRef.current) return;
        if (profileError) throw profileError;

        if (row?.phone && row?.city) {
          redirectedRef.current = true;
          window.location.replace(callbackUrl);
          return;
        }

        setPhone(row?.phone || (user.user_metadata?.phone as string) || '');
        setCity(row?.city || (user.user_metadata?.city as string) || '');
      } catch (err) {
        if (!redirectedRef.current) {
          setError((err as Error).message || 'Impossible de lire le profil.');
        }
      } finally {
        if (!redirectedRef.current) setProfileChecked(true);
      }
    })();
  }, [callbackUrl, router, authLoading, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!PHONE_MA_REGEX.test(phone)) {
      setError('Numero de telephone invalide (ex: 0XXXXXXXXX).');
      return;
    }
    if (!city) {
      setError('La ville est obligatoire.');
      return;
    }

    if (submitting) return;
    setSubmitting(true);
    try {
      if (!supabase) throw new Error('Supabase manquant');
      // Source de verite : le user deja charge dans le contexte React (via
      // SupabaseAuthProvider). JAMAIS refaire un auth.getUser() ici, ca
      // instancierait un cookie-parser potentiellement desynchronise des
      // cookies qui viennent d'etre poses par le callback OAuth, et
      // getUser() renverrait null => "Utilisateur non connecte" bloqueur.
      if (!user) throw new Error('Utilisateur non connecte');
      const currentUser = { id: user.id };

      const { error: updateErr } = await supabase
        .from('users')
        .update({ phone, city })
        .eq('id', currentUser.id);

      if (updateErr) throw updateErr;

      // Best-effort : mise a jour du user_metadata. Si elle echoue (JWT
      // expire, reseau), on ne bloque pas la fin d'inscription : la table
      // users a deja ete mise a jour.
      try {
        await supabase.auth.updateUser({ data: { phone, city } });
      } catch {
        /* noop */
      }

      setSuccess('Profil complete avec succes !');

      // Full reload : middleware + RSC re-executes avec la session a jour.
      window.location.replace(callbackUrl);
    } catch (err) {
      setError((err as Error).message || 'Erreur lors de la mise a jour.');
      setSubmitting(false);
    }
  };

  if (authLoading || !profileChecked) {
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

        {user?.email && (
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
                Connecte avec Google en tant que{' '}
                <strong>{user.email}</strong>
              </span>
            </span>
          </div>
        )}

        <h1 className="font-display font-extrabold text-2xl mb-2 text-center">
          Completer votre <span className="gradient-text">profil</span>
        </h1>
        <p className="text-sm mb-6 text-center" style={{ color: 'var(--text-secondary)' }}>
          Pour finaliser votre inscription et recevoir vos alertes, nous avons besoin de votre numero et ville.
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
            <label className="form-label text-left flex items-center gap-1.5"><Phone size={12} /> Numero de telephone *</label>
            <input type="tel" required className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="06XXXXXXXX" />
          </div>
          <div>
            <label className="form-label text-left flex items-center gap-1.5"><MapPin size={12} /> Ville *</label>
            <SearchableCitySelect value={city} onChange={setCity} placeholder="Choisir une ville" required />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50">
            {submitting ? <Loader2 className="animate-spin" size={16} /> : 'Finaliser mon inscription'}
          </button>
        </form>
      </div>
    </div>
  );
}
