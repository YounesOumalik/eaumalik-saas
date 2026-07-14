'use client';

import { LogIn, UserPlus, KeyRound, User, Gift, Phone, MapPin, Home, Mail, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { maybeSupabaseBrowserClient } from '@/lib/supabase/client';
import { PHONE_MA_REGEX } from '@/lib/utils';
import SearchableCitySelect from '@/components/shared/SearchableCitySelect';
import BrandLogo from '@/components/shared/BrandLogo';
import CaptchaChallenge from '@/components/shared/CaptchaChallenge';

const PasswordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule.')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.');

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
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const isDevMode = !maybeSupabaseBrowserClient();

  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaReload, setCaptchaReload] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Garde-fou côté client (UX uniquement, le serveur revalide tout).
    if (!captchaAnswer || captchaAnswer.trim().length < 4) {
      setError('Merci de compléter le CAPTCHA.');
      return;
    }

    setLoading(true);

    if (isDevMode) {
      // Mode mock : on authentifie l'utilisateur contre src/data/mock.ts
      // via l'API /api/auth/dev-login. Le CAPTCHA est validé côté serveur.
      try {
        const res = await fetch('/api/auth/dev-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            isSignUp,
            captcha_answer: captchaAnswer,
            profile: {
              full_name: fullName,
              phone,
              city,
              address,
              referred_by: referralCode,
            },
          }),
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
        if (json.created) {
          setSuccess('Compte créé avec succès. Vous pouvez maintenant vous connecter.');
          setIsSignUp(false);
          setLoading(false);
          setCaptchaAnswer('');
          return;
        }
        window.dispatchEvent(new Event('eaumalik:dev-session-change'));
        const role = json.user?.role;
        if (role === 'admin' || role === 'staff') {
          router.push('/admin');
        } else {
          router.push(callbackUrl);
        }
        router.refresh();
      } catch (err) {
        setError('Erreur de connexion au mode dev.');
        setLoading(false);
      }
      return;
    }

    if (isSignUp) {
      if (!fullName || fullName.length < 3) { setError('Nom complet obligatoire (min. 3 caractères).'); setLoading(false); return; }
      if (!PHONE_MA_REGEX.test(phone)) { setError('Numéro de téléphone invalide (ex: 0XXXXXXXXX).'); setLoading(false); return; }
      if (!city) { setError('La ville est obligatoire.'); setLoading(false); return; }
      const pwd = PasswordSchema.safeParse(password);
      if (!pwd.success) { setError(pwd.error.issues[0]?.message ?? 'Mot de passe invalide.'); setLoading(false); return; }

      // En mode Supabase on passe par /api/auth/sign-up pour que le CAPTCHA
      // soit validé côté serveur AVANT l'appel à supabase.auth.signUp().
      try {
        const res = await fetch('/api/auth/sign-up', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            captcha_answer: captchaAnswer,
            profile: {
              full_name: fullName,
              phone,
              city,
              address: address || null,
              referred_by: referralCode || null,
            },
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || 'Inscription impossible.');
          setLoading(false);
          if (typeof json.error === 'string' && /captcha/i.test(json.error)) {
            setCaptchaAnswer('');
            setCaptchaReload(n => n + 1);
          }
          return;
        }
        setSuccess('Compte créé avec succès. Vérifiez votre email pour confirmer, puis connectez-vous.');
        setIsSignUp(false);
        setFullName('');
        setPhone('');
        setCity('');
        setAddress('');
        setReferralCode('');
        setCaptchaAnswer('');
        setLoading(false);
        return;
      } catch (err) {
        setError('Erreur lors de la création du compte.');
        setLoading(false);
        return;
      }
    }

    // Mode Supabase — LOGIN : on délègue aussi à une route serveur pour valider
    // le CAPTCHA. Cela garantit qu'aucun script ne peut tenter de brute-forcer
    // un compte sans passer le CAPTCHA.
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
      const userRole = json.user?.role;
      if (userRole === 'admin' || userRole === 'staff') {
        router.push('/admin');
      } else {
        router.push(callbackUrl);
      }
      router.refresh();
    } catch (err) {
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
        <h1 className="font-display font-extrabold text-2xl mb-2 text-center">
          {isSignUp ? <>Créer un <span className="gradient-text">Compte</span></> : <>Connexion <span className="gradient-text">EAUMALIK</span></>}
        </h1>
        <p className="text-sm mb-6 text-center" style={{ color: 'var(--text-secondary)' }}>
          {isSignUp ? 'Rejoignez-nous pour gérer vos commandes, parrainages et alertes.' : 'Accédez à votre espace client, suivi de vos commandes et alertes de maintenance.'}
        </p>

        {error && (
          <div className="p-3 mb-4 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 mb-4 rounded-lg text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label className="form-label text-left flex items-center gap-1.5"><User size={12} /> Nom complet *</label>
                <input type="text" required className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jean Dupont" />
              </div>
              <div>
                <label className="form-label text-left flex items-center gap-1.5"><Phone size={12} /> Numéro de téléphone *</label>
                <input type="tel" required className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="06XXXXXXXX" />
              </div>
              <div>
                <label className="form-label text-left flex items-center gap-1.5"><MapPin size={12} /> Ville *</label>
                <SearchableCitySelect value={city} onChange={setCity} placeholder="Choisir une ville" required />
              </div>
              <div>
                <label className="form-label text-left flex items-center gap-1.5"><Home size={12} /> Adresse (Optionnel)</label>
                <input type="text" className="form-input" value={address} onChange={e => setAddress(e.target.value)} placeholder="Rue, quartier, n°..." />
              </div>
            </>
          )}
          <div>
            <label className="form-label text-left flex items-center gap-1.5"><Mail size={12} /> Email *</label>
            <input type="email" required className="form-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" />
          </div>
          <div>
            <label className="form-label text-left flex items-center gap-1.5"><KeyRound size={12} /> Mot de passe *</label>
            <input type="password" required minLength={8} className="form-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="8+ caractères, 1 majuscule, 1 chiffre" />
          </div>
          {isSignUp && (
            <div>
              <label className="form-label text-left flex items-center gap-1.5"><Gift size={12} /> Code de parrainage (Optionnel)</label>
              <input type="text" className="form-input" value={referralCode} onChange={e => setReferralCode(e.target.value)} placeholder="EX : A1B2C3" />
            </div>
          )}
          <CaptchaChallenge value={captchaAnswer} onChange={setCaptchaAnswer} disabled={loading} reloadToken={captchaReload} />
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={16} /> : isSignUp ? <><UserPlus size={16} /> Créer mon compte</> : <><LogIn size={16} /> Se connecter</>}
          </button>
        </form>

        <div className="flex items-center justify-between mt-5 text-sm">
          {!isSignUp ? (
            <Link href="/login/mot-de-passe-oublie" className="text-primary-400 hover:text-primary-300 font-semibold">
              Mot de passe oublié ?
            </Link>
          ) : <span />}
          <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); setCaptchaAnswer(''); }} className="text-primary-400 hover:text-primary-300 font-semibold">
            {isSignUp ? 'Déjà un compte ? Connectez-vous' : 'Pas de compte ? Créez-en un ici'}
          </button>
        </div>
      </div>
    </div>
  );
}
