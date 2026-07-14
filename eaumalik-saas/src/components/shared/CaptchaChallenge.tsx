'use client';

/**
 * Challenge CAPTCHA maison : affiche le SVG serveur (rechargeable), un champ de
 * saisie et un bouton « ↻ Recharger ». La validation réelle est 100% serveur
 * (cf. src/lib/captcha.ts). Ce composant ne fait AUCUNE confiance au client.
 *
 * Props :
 *   - value / onChange : state contrôlé standard React pour le champ de saisie.
 *   - disabled         : désactive interactions (utile pendant le submit).
 *   - id               : id HTML du champ input (pour labels / aria).
 */
import { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';

interface CaptchaChallengeProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  id?: string;
  /** Changement de cette valeur force un rechargement du CAPTCHA (ex: après une erreur). */
  reloadToken?: number;
}

export default function CaptchaChallenge({ value, onChange, disabled, id = 'captcha-input', reloadToken }: CaptchaChallengeProps) {
  // Timestamp côté client pour casser le cache navigateur sur l'image.
  const [ts, setTs] = useState<number>(() => Date.now());
  // Affiche un état "rechargement" très court lors du refresh, pour le feedback.
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Quand le composant est monté, on force un fetch initial pour s'assurer que
    // le cookie est bien posé avant le premier submit (utile si la page est
    // rendue côté serveur sans hydratation préalable).
    setTs(Date.now());
  }, []);

  // Recharge automatiquement quand le parent signale une erreur CAPTCHA
  // (le cookie a été consommé côté serveur, il faut un nouveau challenge).
  useEffect(() => {
    if (reloadToken && reloadToken > 0) {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  const reload = () => {
    setRefreshing(true);
    setTs(Date.now());
    onChange('');
    // Petit délai pour le feedback visuel (le SVG met ~50ms à arriver).
    setTimeout(() => setRefreshing(false), 400);
  };

  // Feedback visuel local uniquement : si l'utilisateur a tapé un nombre de
  // caractères différent de la longueur cible (5), on colore le champ en
  // rouge. Ce n'est PAS une validation de sécurité, juste un signal UX.
  const EXPECTED_LEN = 5;
  const showLengthMismatch = value.length > 0 && value.length !== EXPECTED_LEN;

  return (
    <div>
      <label htmlFor={id} className="form-label text-left flex items-center gap-1.5">
        <ShieldCheck size={12} /> Vérification anti-robot *
      </label>

      <div className="flex items-stretch gap-2">
        <div
          className="flex-shrink-0 rounded-lg overflow-hidden border"
          style={{ borderColor: 'var(--border)', background: '#f3efe0', height: 56, width: 160 }}
          aria-hidden="false"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/auth/captcha?t=${ts}`}
            alt="CAPTCHA : retapez les 5 caractères affichés"
            width={160}
            height={56}
            draggable={false}
            style={{ display: 'block', userSelect: 'none', height: '100%', width: '100%' }}
          />
        </div>

        <button
          type="button"
          onClick={reload}
          disabled={disabled || refreshing}
          className="btn-outline flex-shrink-0 px-3"
          aria-label="Recharger le CAPTCHA"
          title="Recharger le CAPTCHA"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>

        <input
          id={id}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          required
          maxLength={EXPECTED_LEN}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="5 caractères"
          className="form-input flex-1 font-mono tracking-widest text-center"
          style={{
            borderColor: showLengthMismatch ? 'var(--danger)' : undefined,
          }}
          aria-invalid={showLengthMismatch || undefined}
        />
      </div>

      {showLengthMismatch && (
        <p className="text-[11px] mt-1" style={{ color: 'var(--danger)' }}>
          Le CAPTCHA contient {EXPECTED_LEN} caractères.
        </p>
      )}
    </div>
  );
}