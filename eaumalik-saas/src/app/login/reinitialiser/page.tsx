'use client';

import { KeyRound, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BrandLogo from '@/components/shared/BrandLogo';
import CaptchaChallenge from '@/components/shared/CaptchaChallenge';

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
  const token = searchParams.get('token') || '';

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

    if (!token) {
      setError('Lien de réinitialisation invalide ou expiré.');
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
    if (password !== passwordConfirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
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
      // Redirige vers la connexion après un court délai.
      setTimeout(() => router.push('/login'), 1800);
    } catch (err) {
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
            <label className="form-label text-left flex items-center gap-1.5"><KeyRound size={12} /> Nouveau mot de passe *</label>
            <input type="password" required minLength={8} className="form-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="8+ caractères, 1 majuscule, 1 chiffre" />
          </div>
          <div>
            <label className="form-label text-left flex items-center gap-1.5"><KeyRound size={12} /> Confirmer le mot de passe *</label>
            <input type="password" required minLength={8} className="form-input" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} placeholder="Retapez le mot de passe" />
          </div>
          <CaptchaChallenge value={captchaAnswer} onChange={setCaptchaAnswer} disabled={loading} reloadToken={captchaReload} />
          <button type="submit" disabled={loading || !token} className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={16} /> : <><KeyRound size={16} /> Mettre à jour</>}
          </button>
        </form>

        <div className="text-center mt-5 text-sm">
          <Link href="/login" className="text-primary-400 hover:text-primary-300 font-semibold inline-flex items-center gap-1.5">
            <ArrowLeft size={14} /> Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
