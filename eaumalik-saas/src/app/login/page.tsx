'use client';

import { LogIn, KeyRound, Mail, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { maybeSupabaseBrowserClient } from '@/lib/supabase/client';
import BrandLogo from '@/components/shared/BrandLogo';
import CaptchaChallenge from '@/components/shared/CaptchaChallenge';
import { useSupabaseAuth } from '@/components/shared/SupabaseAuthProvider';
import { browserSafeOrigin, safeCallbackPath } from '@/lib/navigation';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function redirectToSafeBrowserOrigin() {
  const safeOrigin = browserSafeOrigin(window.location.origin);
  if (safeOrigin === window.location.origin) return false;

  window.location.replace(
    `${safeOrigin}${window.location.pathname}${window.location.search}${window.location.hash}`
  );
  return true;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center">Chargement…</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackPath(searchParams.get('callbackUrl'), '/');
  const passwordResetSuccess = searchParams.get('password_reset') === 'success';
  const isDevMode = !maybeSupabaseBrowserClient();
  const { refresh } = useSupabaseAuth();

  // 'choice' = écran de choix (client Google / staff admin)
  // 'admin'  = formulaire email + mot de passe + CAPTCHA (staff uniquement)
  const [mode, setMode] = useState<'choice' | 'admin'>('choice');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Champs du formulaire admin
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaReload, setCaptchaReload] = useState(0);
  const googleLoginRef = useRef(false);

  // Canonicalise the browser host before Supabase creates the PKCE verifier
  // cookie. Changing only redirectTo afterwards would move the callback to a
  // different host and the verifier cookie would no longer be available.
  useEffect(() => {
    redirectToSafeBrowserOrigin();
  }, []);

  const handleGoogleLogin = async () => {
    // Keep the same guard synchronously: a very fast click can happen before
    // the mount effect above has had time to canonicalise the page.
    if (redirectToSafeBrowserOrigin()) return;

    // Guard synchrone : empeche tout double appel (setState est asynchrone,
    // donc le disabled={loading} peut ne pas etre encore applique).
    if (googleLoginRef.current) return;
    googleLoginRef.current = true;
    setLoading(true);
    setError('');
    try {
      const supabase = maybeSupabaseBrowserClient();
      if (!supabase) {
        setError('Configuration Supabase manquante.');
        setLoading(false);
        googleLoginRef.current = false;
        return;
      }

      // Filet de sécurité : si signInWithOAuth ne navigue pas (popup blocker,
      // erreur réseau, ou bibliothèque qui ne fait plus de window.location
      // assign depuis @supabase/ssr >= 0.5), on remet le bouton en état après
      // 8s plutôt que de laisser le spinner infini.
      const safetyTimeout = window.setTimeout(() => {
        googleLoginRef.current = false;
        setLoading(false);
        setError(
          'La fenêtre Google ne s\u2019est pas ouverte. Vérifiez votre bloqueur de popups puis réessayez.'
        );
      }, 8000);

      // `prompt: 'select_account'` force Google à TOUJOURS afficher le sélecteur
      // de compte, même si l\u2019utilisateur a déjà une session Google active.
      //
      const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${browserSafeOrigin(window.location.origin)}/api/auth/callback?callbackUrl=${encodeURIComponent(callbackUrl)}`,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      window.clearTimeout(safetyTimeout);

      if (oauthErr) {
        setError(oauthErr.message);
        setLoading(false);
        googleLoginRef.current = false;
        return;
      }

      // The browser client navigates to data.url unless skipBrowserRedirect is set.
      if (!data?.url) {
        setLoading(false);
        googleLoginRef.current = false;
        setError('Impossible de démarrer la connexion Google (URL manquante).');
      }
    } catch (err) {
      setError((err as Error)?.message || 'Erreur de connexion Google.');
      setLoading(false);
      googleLoginRef.current = false;
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!captchaAnswer || captchaAnswer.trim().length < 4) {
      setError('Merci de compléter le CAPTCHA.');
      return;
    }
    setLoading(true);

    if (isDevMode) {
      try {
        const res = await fetch('/api/auth/dev-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, captcha_answer: captchaAnswer }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || 'Identifiants invalides.');
          setLoading(false);
          if (typeof json.error === 'string' && /captcha/i.test(json.error)) {
            setCaptchaAnswer('');
            setCaptchaReload(n => n + 1);
          }
          return;
        }
        window.dispatchEvent(new Event('eaumalik:dev-session-change'));
        await refresh();
        const role = json.user?.role;
        if (role === 'admin' || role === 'staff') {
          router.push('/admin');
        } else {
          router.push(callbackUrl);
        }
        router.refresh();
      } catch {
        setError('Erreur de connexion au mode dev.');
        setLoading(false);
      }
      return;
    }

    try {
      const res = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, captcha_answer: captchaAnswer }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Email ou mot de passe incorrect.');
        setLoading(false);
        if (typeof json.error === 'string' && /captcha/i.test(json.error)) {
          setCaptchaAnswer('');
          setCaptchaReload(n => n + 1);
        }
        return;
      }
      await refresh();
      const userRole = json.user?.role;
      if (userRole === 'admin' || userRole === 'staff') {
        router.push('/admin');
      } else {
        router.push(callbackUrl);
      }
      router.refresh();
    } catch {
      setError('Erreur de connexion.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="glass-card p-8 max-w-md w-full" style={{ transform: 'none' }}>
        <div className="mb-6 flex justify-center">
          <BrandLogo size="lg" priority />
        </div>

        {mode === 'choice' ? (
          <>
            <h1 className="font-display font-extrabold text-2xl mb-2 text-center">
              Connexion <span className="gradient-text">EAUMALIK</span>
            </h1>
            <p className="text-sm mb-6 text-center" style={{ color: 'var(--text-secondary)' }}>
              Connectez-vous pour accéder à votre espace client, suivre vos commandes et alertes de maintenance.
            </p>

            {error && (
              <div className="p-3 mb-4 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-400">
                {error}
              </div>
            )}

            {passwordResetSuccess && (
              <div className="p-3 mb-4 rounded-lg text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                Votre mot de passe a été réinitialisé. Vous pouvez vous connecter avec le nouveau.
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <><GoogleIcon /> Continuer avec Google</>}
            </button>

            <div className="flex items-center my-5">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="px-3 text-xs" style={{ color: 'var(--text-secondary)' }}>ou</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            <button
              type="button"
              onClick={() => { setMode('admin'); setError(''); }}
              className="btn-outline w-full justify-center py-3 text-base flex items-center gap-2"
            >
              <ShieldCheck size={16} /> Espace Administration
            </button>

            <p className="text-xs text-center mt-4" style={{ color: 'var(--text-secondary)' }}>
              En vous connectant, vous acceptez nos Conditions Générales de Vente.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display font-extrabold text-2xl mb-2 text-center">
              Administration <span className="gradient-text">EAUMALIK</span>
            </h1>
            <p className="text-sm mb-6 text-center" style={{ color: 'var(--text-secondary)' }}>
              Accès réservé au personnel autorisé. Connexion par email et mot de passe.
            </p>

            {error && (
              <div className="p-3 mb-4 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="form-label text-left flex items-center gap-1.5"><Mail size={12} /> Email *</label>
                <input type="email" required className="form-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@eaumalik.com" />
              </div>
              <div>
                <label className="form-label text-left flex items-center gap-1.5"><KeyRound size={12} /> Mot de passe *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    className="form-input pr-10"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Votre mot de passe"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <CaptchaChallenge value={captchaAnswer} onChange={setCaptchaAnswer} disabled={loading} reloadToken={captchaReload} />
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" size={16} /> : <><LogIn size={16} /> Se connecter</>}
              </button>
            </form>

            <div className="flex items-center justify-center mt-5 text-sm">
              <button type="button" onClick={() => { setMode('choice'); setError(''); setPassword(''); setCaptchaAnswer(''); }} className="text-primary-400 hover:text-primary-300 font-semibold">
                ← Retour
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
