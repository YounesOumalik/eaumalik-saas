'use client';

import { KeyRound, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BrandLogo from '@/components/shared/BrandLogo';
import CaptchaChallenge from '@/components/shared/CaptchaChallenge';
import { maybeSupabaseBrowserClient } from '@/lib/supabase/client';

// ⚠️ Client-safe mock check (NE PAS importer @/lib/api-guard ici :
// il contient 'server-only' qui casserait le build webpack).
function isClientMockMode(): boolean {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') return true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !url || !key || url.trim() === '' || key.trim() === '';
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center">Chargement…</div>}>
      <ResetInner />
    </Suspense>
  );
}

function ResetInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Mode MOCK : token en query string (?token=...)
  // Mode SUPABASE : hash fragment (#access_token=...&type=recovery&...)
  //   → @supabase/ssr détecte la session automatiquement, on valide via getSession().
  const mock = isClientMockMode();
  const queryToken = mock ? searchParams.get('token') || '' : '';
  const [recoveryReady, setRecoveryReady] = useState(mock); // en mock, prêt tout de suite
  const [recoveryError, setRecoveryError] = useState('');

  useEffect(() => {
    if (mock) return; // mode mock : pas de hash à traiter
    const supabase = maybeSupabaseBrowserClient();
    if (!supabase) {
      setRecoveryError('Configuration Supabase manquante côté client.');
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error) {
        setRecoveryError(error.message);
        return;
      }
      if (!data.session) {
        setRecoveryError(
          "Lien de réinitialisation invalide ou expiré. Demandez-en un nouveau depuis « Mot de passe oublié »."
        );
        return;
      }
      setRecoveryReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [mock]);

  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaReload, setCaptchaReload] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!recoveryReady) {
      setError(recoveryError || 'Lien de réinitialisation invalide ou expiré.');
      return;
    }
    if (!captchaAnswer || captchaAnswer.trim().length < 4) {
      setError('Merci de compléter le CAPTCHA.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Le mot de passe doit contenir au moins 1 majuscule et 1 chiffre.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      if (mock) {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: queryToken,
            password,
            password_confirm: passwordConfirm,
            captcha_answer: captchaAnswer,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || 'Réinitialisation impossible.');
          setLoading(false);
          if (typeof json.error === 'string' && /captcha/i.test(json.error)) {
            setCaptchaAnswer('');
            setCaptchaReload(n => n + 1);
          }
          return;
        }
        setSuccess(json.message || 'Mot de passe mis à jour avec succès.');
        setPassword('');
        setPasswordConfirm('');
        setCaptchaAnswer('');
        setLoading(false);
        setTimeout(() => router.push('/login'), 1800);
        return;
      }

      // Mode SUPABASE : on a une session recovery active, on applique le nouveau MDP.
      const supabase = maybeSupabaseBrowserClient();
      if (!supabase) {
        setError('Configuration Supabase manquante.');
        setLoading(false);
        return;
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        setError(updateErr.message);
        setLoading(false);
        return;
      }
      // On déconnecte la session de recovery pour forcer une reconnexion propre.
      await supabase.auth.signOut();
      setSuccess('Mot de passe mis à jour avec succès. Vous pouvez maintenant vous connecter.');
      setPassword('');
      setPasswordConfirm('');
      setLoading(false);
      setTimeout(() => router.push('/login'), 1800);
    } catch {
      setError('Erreur lors de la réinitialisation.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="glass-card p-8 max-w-md w-full" style={{ transform: 'none' }}>
        <div className="mb-6 flex justify-center">
          <BrandLogo size="lg" priority />
        </div>
        <h1 className="font-display font-extrabold text-2xl mb-2 text-center">
          Réinitialiser le <span className="gradient-text">mot de passe</span>
        </h1>
        <p className="text-sm mb-6 text-center" style={{ color: 'var(--text-secondary)' }}>
          Choisissez un nouveau mot de passe pour votre compte EAUMALIK.
        </p>

        {!recoveryReady && recoveryError && (
          <div className="p-3 mb-4 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-400">
            {recoveryError}
          </div>
        )}
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

        {recoveryReady && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label text-left flex items-center gap-1.5"><KeyRound size={12} /> Nouveau mot de passe *</label>
              <input
                type="password"
                required
                minLength={8}
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="8+ caractères, 1 majuscule, 1 chiffre"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="form-label text-left flex items-center gap-1.5"><KeyRound size={12} /> Confirmer le mot de passe *</label>
              <input
                type="password"
                required
                minLength={8}
                className="form-input"
                value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)}
                placeholder="Retapez le mot de passe"
                autoComplete="new-password"
              />
            </div>
            <CaptchaChallenge value={captchaAnswer} onChange={setCaptchaAnswer} disabled={loading} reloadToken={captchaReload} />
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={16} /> : <><KeyRound size={16} /> Mettre à jour</>}
            </button>
          </form>
        )}

        <div className="text-center mt-5 text-sm">
          <Link href="/login/mot-de-passe-oublie" className="text-primary-400 hover:text-primary-300 font-semibold inline-flex items-center gap-1.5">
            <ArrowLeft size={14} /> Demander un nouveau lien
          </Link>
        </div>
      </div>
    </div>
  );
}
