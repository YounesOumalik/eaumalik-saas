'use client';

import { Mail, LogIn, UserPlus, KeyRound, User, Gift, Phone, MapPin, Home, Loader2 } from 'lucide-react';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseBrowserClient, maybeSupabaseBrowserClient } from '@/lib/supabase/client';
import { PHONE_MA_REGEX } from '@/lib/utils';
import SearchableCitySelect from '@/components/shared/SearchableCitySelect';

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

  const handleGoogle = async () => {
    setError('');
    const supabase = createSupabaseBrowserClient();
    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/login?callbackUrl=${encodeURIComponent(callbackUrl)}` },
      });
      if (oauthErr) setError(oauthErr.message);
    } catch (err: any) {
      setError('Connexion Google indisponible.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (isDevMode) {
      setError("Authentification indisponible : variables d'environnement Supabase non configurées.");
      setLoading(false);
      return;
    }

    if (isSignUp) {
      if (!fullName || fullName.length < 3) { setError('Nom complet obligatoire (min. 3 caractères).'); setLoading(false); return; }
      if (!PHONE_MA_REGEX.test(phone)) { setError('Numéro de téléphone invalide (ex: 06XXXXXXXX).'); setLoading(false); return; }
      if (!city) { setError('La ville est obligatoire.'); setLoading(false); return; }
      const pwd = PasswordSchema.safeParse(password);
      if (!pwd.success) { setError(pwd.error.issues[0]?.message ?? 'Mot de passe invalide.'); setLoading(false); return; }

      const supabase = createSupabaseBrowserClient();
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, phone, city, address: address || null, referred_by: referralCode || null },
        },
      });

      if (signUpErr) {
        setError(signUpErr.message || 'Inscription impossible.');
        setLoading(false);
        return;
      }
      setSuccess('Compte créé avec succès. Vérifiez votre email pour confirmer, puis connectez-vous.');
      setIsSignUp(false);
      setFullName('');
      setPhone('');
      setCity('');
      setAddress('');
      setReferralCode('');
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      setError('Email ou mot de passe incorrect.');
      setLoading(false);
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="glass-card p-8 max-w-md w-full" style={{ transform: 'none' }}>
        <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-5" style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-dark))' }}>
          <i className="fa-solid fa-droplet text-white text-xl" aria-hidden="true" />
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

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
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
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={16} /> : isSignUp ? <><UserPlus size={16} /> Créer mon compte</> : <><LogIn size={16} /> Se connecter</>}
          </button>
        </form>

        <div className="relative flex items-center justify-center my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[color:var(--border)]" /></div>
          <span className="relative px-3 text-xs uppercase bg-[color:var(--bg-surface)]" style={{ color: 'var(--text-muted)' }}>Ou</span>
        </div>

        <button onClick={handleGoogle} disabled={loading} className="btn-outline w-full justify-center py-2.5 text-sm disabled:opacity-50 mb-6">
          <Mail size={16} aria-hidden="true" /> Google Login
        </button>

        <div className="text-center text-sm">
          <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); }} className="text-primary-400 hover:text-primary-300 font-semibold">
            {isSignUp ? 'Déjà un compte ? Connectez-vous' : 'Pas de compte ? Créez-en un ici'}
          </button>
        </div>
      </div>
    </div>
  );
}
