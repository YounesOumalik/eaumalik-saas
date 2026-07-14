'use client';

import { Mail, KeyRound, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BrandLogo from '@/components/shared/BrandLogo';
import CaptchaChallenge from '@/components/shared/CaptchaChallenge';

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center">Chargement…</div>}>
      <ForgotInner />
    </Suspense>
  );
}

function ForgotInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaReload, setCaptchaReload] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!captchaAnswer || captchaAnswer.trim().length < 4) {
      setError('Merci de compléter le CAPTCHA.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, captcha_answer: captchaAnswer }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Demande impossible.');
        setLoading(false);
        if (typeof json.error === 'string' && /captcha/i.test(json.error)) {
          setCaptchaAnswer('');
          setCaptchaReload(n => n + 1);
        }
        return;
      }
      // Message générique (ne révèle pas si l'email existe).
      setSuccess(
        json.message ||
          "Si un compte existe avec cet email, vous recevrez sous peu les instructions de réinitialisation."
      );
      setEmail('');
      setCaptchaAnswer('');
      setLoading(false);
    } catch (err) {
      setError('Erreur lors de la demande.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="glass-card p-8 max-w-md w-full" style={{ transform: 'none' }}>
        <div className="mb-6 flex justify-center">
          <BrandLogo size="lg" tone="light" priority />
        </div>
        <h1 className="font-display font-extrabold text-2xl mb-2 text-center">
          Mot de passe <span className="gradient-text">oublié</span>
        </h1>
        <p className="text-sm mb-6 text-center" style={{ color: 'var(--text-secondary)' }}>
          Saisissez votre email et nous vous enverrons les instructions de réinitialisation.
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
          <div>
            <label className="form-label text-left flex items-center gap-1.5"><Mail size={12} /> Email *</label>
            <input type="email" required className="form-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" />
          </div>
          <CaptchaChallenge value={captchaAnswer} onChange={setCaptchaAnswer} disabled={loading} reloadToken={captchaReload} />
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={16} /> : <><KeyRound size={16} /> Envoyer les instructions</>}
          </button>
        </form>

        <div className="text-center mt-5 text-sm">
          <Link href={`/login${callbackUrl !== '/' ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`} className="text-primary-400 hover:text-primary-300 font-semibold inline-flex items-center gap-1.5">
            <ArrowLeft size={14} /> Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
