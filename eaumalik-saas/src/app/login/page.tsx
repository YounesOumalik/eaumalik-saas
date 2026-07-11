'use client';

import { signIn } from 'next-auth/react';
import { Mail, LogIn, UserPlus, KeyRound, User, Gift, Phone, MapPin, Home } from 'lucide-react';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { registerUserAction } from '@/app/actions/authActions';
import { PHONE_MA_REGEX } from '@/lib/utils';
import SearchableCitySelect from '@/components/shared/SearchableCitySelect';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [referralCode, setReferralCode] = useState('');

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      await signIn('google', { callbackUrl });
    } catch {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (isSignUp) {
      if (!fullName) {
        setError('Nom complet obligatoire.');
        setLoading(false);
        return;
      }
      if (!phone) {
        setError('Numéro de téléphone obligatoire.');
        setLoading(false);
        return;
      }
      if (!PHONE_MA_REGEX.test(phone)) {
        setError('Le numéro de téléphone est invalide (ex: 06XXXXXXXX).');
        setLoading(false);
        return;
      }
      if (!city) {
        setError('La ville est obligatoire.');
        setLoading(false);
        return;
      }

      // Register new user
      const res = await registerUserAction({
        email,
        passwordHash: password, // directly using plaintext for local mock DB ease
        full_name: fullName,
        phone,
        city,
        address: address || undefined,
        referredBy: referralCode || undefined
      });

      if (res.success) {
        setSuccess('Compte cree avec succes ! Vous pouvez maintenant vous connecter.');
        setIsSignUp(false);
        setFullName('');
        setPhone('');
        setCity('');
        setAddress('');
        setReferralCode('');
        setLoading(false);
      } else {
        setError(res.error || 'Erreur lors de la creation du compte.');
        setLoading(false);
      }
    } else {
      // Login
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false
      });

      if (res?.ok) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        setError('Email ou mot de passe incorrect.');
        setLoading(false);
      }
    }
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
                <input
                  type="text"
                  required
                  className="form-input"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Jean Dupont"
                />
              </div>
              <div>
                <label className="form-label text-left flex items-center gap-1.5"><Phone size={12} /> Numéro de téléphone *</label>
                <input
                  type="tel"
                  required
                  className="form-input"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="06XXXXXXXX"
                />
              </div>
              <div>
                <label className="form-label text-left flex items-center gap-1.5"><MapPin size={12} /> Ville *</label>
                <SearchableCitySelect
                  value={city}
                  onChange={setCity}
                  placeholder="Choisir une ville"
                  required
                />
              </div>
              <div>
                <label className="form-label text-left flex items-center gap-1.5"><Home size={12} /> Adresse (Optionnel)</label>
                <input
                  type="text"
                  className="form-input"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Rue, quartier, n°..."
                />
              </div>
            </>
          )}
          <div>
            <label className="form-label text-left flex items-center gap-1.5"><Mail size={12} /> Email *</label>
            <input
              type="email"
              required
              className="form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="votre@email.com"
            />
          </div>
          <div>
            <label className="form-label text-left flex items-center gap-1.5"><KeyRound size={12} /> Mot de passe *</label>
            <input
              type="password"
              required
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {isSignUp && (
            <div>
              <label className="form-label text-left flex items-center gap-1.5"><Gift size={12} /> Code de parrainage (Optionnel)</label>
              <input
                type="text"
                className="form-input"
                value={referralCode}
                onChange={e => setReferralCode(e.target.value)}
                placeholder="EX: A1B2C3"
              />
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50">
            {loading ? 'Traitement...' : isSignUp ? <><UserPlus size={16} /> Créer mon compte</> : <><LogIn size={16} /> Se connecter</>}
          </button>
        </form>

        <div className="relative flex items-center justify-center my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[color:var(--border)]"></div></div>
          <span className="relative px-3 text-xs uppercase bg-[color:var(--bg-surface)]" style={{ color: 'var(--text-muted)' }}>Ou</span>
        </div>

        <button onClick={handleGoogle} disabled={loading} className="btn-outline w-full justify-center py-2.5 text-sm disabled:opacity-50 mb-6">
          <Mail size={16} aria-hidden="true" /> Google Login
        </button>

        <div className="text-center text-sm">
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); }}
            className="text-primary-400 hover:text-primary-300 font-semibold"
          >
            {isSignUp ? 'Déjà un compte ? Connectez-vous' : 'Pas de compte ? Créez-en un ici'}
          </button>
        </div>

        <div className="mt-6 pt-4 text-[10px] text-center" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          Mode démo : Administration = <span className="font-mono">eaumaliksarl@gmail.com</span> / <span className="font-mono">adminpassword123</span>
        </div>
      </div>
    </div>
  );
}
