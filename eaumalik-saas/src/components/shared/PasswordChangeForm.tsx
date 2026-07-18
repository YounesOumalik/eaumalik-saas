'use client';

import { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { changeOwnPasswordAction } from '@/app/actions/clientActions';
import { useToast } from '@/components/shared/ToastProvider';

export default function PasswordChangeForm() {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const result = await changeOwnPasswordAction({
      current_password: currentPassword,
      new_password: newPassword,
      confirmation,
    });
    if (result.success) {
      toast('Mot de passe modifié avec succès.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
    } else {
      toast('Erreur : ' + result.error, 'error');
    }
    setSubmitting(false);
  };

  return (
    <div className="glass-card p-6 max-w-xl" style={{ transform: 'none' }}>
      <h1 className="font-display font-bold text-xl mb-2 flex items-center gap-2">
        <KeyRound size={18} className="text-primary-light" /> Sécurité du compte
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Modifiez votre mot de passe. Il reste confidentiel et n’est jamais visible par l’administration.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <PasswordField label="Mot de passe actuel" value={currentPassword} onChange={setCurrentPassword} visible={visible.current} onToggle={() => setVisible(v => ({ ...v, current: !v.current }))} autoComplete="current-password" disabled={submitting} />
        <PasswordField label="Nouveau mot de passe" value={newPassword} onChange={setNewPassword} visible={visible.new} onToggle={() => setVisible(v => ({ ...v, new: !v.new }))} autoComplete="new-password" disabled={submitting} />
        <PasswordField label="Confirmer le nouveau mot de passe" value={confirmation} onChange={setConfirmation} visible={visible.confirm} onToggle={() => setVisible(v => ({ ...v, confirm: !v.confirm }))} autoComplete="new-password" disabled={submitting} />
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Minimum 12 caractères, avec majuscule, minuscule et chiffre.
        </p>
        <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-2.5 text-sm disabled:opacity-50">
          {submitting ? 'Modification...' : 'Modifier le mot de passe'}
        </button>
      </form>
    </div>
  );
}

function PasswordField({
  label, value, onChange, visible, onToggle, autoComplete, disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible?: boolean;
  onToggle: () => void;
  autoComplete: string;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="form-label flex items-center gap-1.5"><KeyRound size={12} /> {label} *</label>
      <div className="relative">
        <input type={visible ? 'text' : 'password'} required className="form-input pr-10" value={value} onChange={e => onChange(e.target.value)} autoComplete={autoComplete} disabled={disabled} />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200" aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}
