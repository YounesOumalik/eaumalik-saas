'use client';

import { Suspense, useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { maybeSupabaseBrowserClient } from '@/lib/supabase/client';
import BrandLogo from '@/components/shared/BrandLogo';
import CaptchaChallenge from '@/components/shared/CaptchaChallenge';
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/passwordPolicy';

export default function PasswordResetPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center">Chargement…</div>}>
      <PasswordResetInner />
    </Suspense>
  );
}

function PasswordResetInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? undefined;
  const supabase = maybeSupabaseBrowserClient();
  const [ready, setReady] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [reloadCaptcha, setReloadCaptcha] = useState(0);
  const [showNew, setShowNew] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const checkRecovery = async () => {
      if (!supabase) {
        setReady(Boolean(token));
        return;
      }
      // Le client Supabase traite le hash du lien de récupération et installe
      // la session avant que le formulaire ne puisse être envoyé.
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        setReady(Boolean(data.session));
        if (!data.session) setError('Lien de réinitialisation invalide ou expiré.');
      }
    };
    void checkRecovery();
    return () => { cancelled = true; };
  }, [supabase, token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`);
      return;
    }
    if (newPassword !== confirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (!captcha.trim()) {
      setError('Merci de compléter le CAPTCHA.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/complete-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_password: newPassword,
          confirmation,
          captcha_answer: captcha,
          token,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? 'Réinitialisation impossible.');
        setCaptcha('');
        setReloadCaptcha(value => value + 1);
        setLoading(false);
        return;
      }
      router.replace('/login?password_reset=success');
    } catch {
      setError('Erreur de connexion. Réessayez.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="glass-card p-8 max-w-md w-full" style={{ transform: 'none' }}>
        <div className="mb-6 flex justify-center"><BrandLogo size="lg" priority /></div>
        <div className="flex items-center justify-center gap-2 mb-2 text-primary-light">
          <ShieldCheck size={20} />
          <h1 className="font-display font-extrabold text-2xl text-center">Nouveau mot de passe</h1>
        </div>
        <p className="text-sm mb-6 text-center" style={{ color: 'var(--text-secondary)' }}>
          Choisissez un nouveau mot de passe pour sécuriser votre espace EAUMALIK.
        </p>

        {error && <div className="p-3 mb-4 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-400">{error}</div>}

        {!ready ? (
          <div className="text-center text-sm py-6" style={{ color: 'var(--text-muted)' }}>
            Vérification du lien…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField
              id="new-password"
              label="Nouveau mot de passe"
              value={newPassword}
              onChange={setNewPassword}
              visible={showNew}
              onToggle={() => setShowNew(value => !value)}
              disabled={loading}
              autoComplete="new-password"
            />
            <PasswordField
              id="confirm-password"
              label="Confirmer le mot de passe"
              value={confirmation}
              onChange={setConfirmation}
              visible={showConfirmation}
              onToggle={() => setShowConfirmation(value => !value)}
              disabled={loading}
              autoComplete="new-password"
            />
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Minimum {PASSWORD_MIN_LENGTH} caractères, avec majuscule, minuscule et chiffre.
            </p>
            <CaptchaChallenge value={captcha} onChange={setCaptcha} disabled={loading} reloadToken={reloadCaptcha} />
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={16} /> : 'Enregistrer le nouveau mot de passe'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function PasswordField({
  id, label, value, onChange, visible, onToggle, disabled, autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  disabled: boolean;
  autoComplete: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="form-label flex items-center gap-1.5"><KeyRound size={12} /> {label} *</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete={autoComplete}
          className="form-input pr-10"
          value={value}
          onChange={event => onChange(event.target.value)}
          disabled={disabled}
        />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}
