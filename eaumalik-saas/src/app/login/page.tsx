'use client';

import { signIn } from 'next-auth/react';
import { Mail, LogIn } from 'lucide-react';
import { useState } from 'react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signIn('google', { callbackUrl: '/' });
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="glass-card p-8 max-w-md w-full text-center" style={{ transform: 'none' }}>
        <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-5" style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-dark))' }}>
          <i className="fa-solid fa-droplet text-white text-xl" aria-hidden="true" />
        </div>
        <h1 className="font-display font-extrabold text-2xl mb-2">
          Connexion <span className="gradient-text">EAUMALIK</span>
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          Accedez a votre espace client, suivi de vos commandes et alertes de maintenance.
        </p>
        <button onClick={handleGoogle} disabled={loading} className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50">
          {loading ? 'Connexion...' : <><Mail size={16} aria-hidden="true" /> Continuer avec Google</>}
        </button>
        <p className="text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          En vous connectant, vous acceptez nos conditions generales et notre politique de confidentialite.
        </p>
        <div className="mt-6 pt-6 text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <LogIn size={12} className="inline mr-1" /> Mode demo : tout utilisateur Google est accepte.
        </div>
      </div>
    </div>
  );
}
