'use client';

import { useState } from 'react';
import { Plus, Edit2, Trash2, Shield, X } from 'lucide-react';
import { useToast } from '@/components/shared/ToastProvider';
import { createStaffUserAction, updateStaffUserAction, deleteStaffUserAction } from '@/app/actions/adminActions';
import { formatCurrency } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Superadministrateur',
  technician: 'Technicien',
  stock_manager: 'Gestionnaire de Stock',
  sales: 'Commercial',
  admin_assistant: 'Assistante d\'Administration',
};

const DEFAULT_PERMISSIONS = {
  can_view_products: false,
  can_edit_products: false,
  can_validate_orders: false,
  can_follow_prospects: false,
  can_view_comptabilite: false,
  can_view_stocks: false,
};

export default function StaffManager({ initialStaff }: { initialStaff: any[] }) {
  const [staffList, setStaffList] = useState<any[]>(initialStaff);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any | null>(null);

  // Form Fields
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('sales');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [submitting, setSubmitting] = useState(false);

  const toast = useToast();

  const handleOpenCreate = () => {
    setEditingStaff(null);
    setEmail('');
    setFullName('');
    setPhone('');
    setRole('sales');
    setPassword('');
    setPermissions({
      can_view_products: true,
      can_edit_products: false,
      can_validate_orders: true,
      can_follow_prospects: true,
      can_view_comptabilite: false,
      can_view_stocks: false,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (member: any) => {
    setEditingStaff(member);
    setEmail(member.email);
    setFullName(member.full_name);
    setPhone(member.phone || '');
    setRole(member.role);
    setPassword('');
    setPermissions(member.permissions || DEFAULT_PERMISSIONS);
    setModalOpen(true);
  };

  const handleRoleChange = (selectedRole: string) => {
    setRole(selectedRole);
    // Auto-suggest permissions based on role
    if (selectedRole === 'admin') {
      setPermissions({
        can_view_products: true,
        can_edit_products: true,
        can_validate_orders: true,
        can_follow_prospects: true,
        can_view_comptabilite: true,
        can_view_stocks: true,
      });
    } else if (selectedRole === 'technician') {
      setPermissions({
        can_view_products: true,
        can_edit_products: false,
        can_validate_orders: false,
        can_follow_prospects: false,
        can_view_comptabilite: false,
        can_view_stocks: true,
      });
    } else if (selectedRole === 'stock_manager') {
      setPermissions({
        can_view_products: true,
        can_edit_products: true,
        can_validate_orders: false,
        can_follow_prospects: false,
        can_view_comptabilite: false,
        can_view_stocks: true,
      });
    } else if (selectedRole === 'sales') {
      setPermissions({
        can_view_products: true,
        can_edit_products: false,
        can_validate_orders: true,
        can_follow_prospects: true,
        can_view_comptabilite: false,
        can_view_stocks: false,
      });
    } else if (selectedRole === 'admin_assistant') {
      setPermissions({
        can_view_products: true,
        can_edit_products: false,
        can_validate_orders: true,
        can_follow_prospects: true,
        can_view_comptabilite: false,
        can_view_stocks: true,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !fullName.trim() || submitting) return;
    setSubmitting(true);

    if (editingStaff) {
      const res = await updateStaffUserAction(editingStaff.id, {
        email,
        full_name: fullName,
        phone,
        role,
        password: password || undefined,
        permissions,
      });

      if (res.success) {
        // Met à jour l'utilisateur dans la liste (on a déjà editingStaff en mémoire).
        setStaffList(prev =>
          prev.map(u => (u.id === editingStaff.id
            ? { ...u, email, full_name: fullName, phone, role, permissions }
            : u))
        );
        toast('Membre du personnel mis à jour avec succès.', 'success');
        setModalOpen(false);
      } else {
        toast('Erreur lors de la mise à jour : ' + res.error, 'error');
      }
    } else {
      if (!password) {
        toast('Mot de passe requis pour la création.', 'error');
        setSubmitting(false);
        return;
      }

      const res = await createStaffUserAction({
        email,
        passwordHash: password,
        full_name: fullName,
        phone,
        role,
        permissions,
      });

      if (res.success && res.staff) {
        setStaffList(prev => [...prev, res.staff]);
        toast('Membre du personnel créé avec succès.', 'success');
        setModalOpen(false);
      } else {
        toast('Erreur : ' + res.error, 'error');
      }
    }
    setSubmitting(false);
  };

  const handleDelete = async (memberId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce compte de personnel ?')) return;

    const res = await deleteStaffUserAction(memberId);
    if (res.success) {
      setStaffList(prev => prev.filter(u => u.id !== memberId));
      toast('Compte de personnel supprimé.', 'success');
    } else {
      toast('Erreur : ' + res.error, 'error');
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-display font-extrabold text-xl">Gestion du Personnel & Droits</h2>
        <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Ajouter un membre
        </button>
      </div>

      <div className="glass-card overflow-x-auto" style={{ transform: 'none' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Personnel</th>
              <th>Rôle</th>
              <th>Téléphone</th>
              <th>Droits d&apos;accès</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map(member => (
              <tr key={member.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold text-xs">
                      {member.full_name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{member.full_name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{member.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    member.role === 'admin' ? 'bg-red-500/15 text-red-400' : 'bg-cyan-500/15 text-cyan-400'
                  }`}>
                    {ROLE_LABELS[member.role] || member.role}
                  </span>
                </td>
                <td className="text-sm">{member.phone || '—'}</td>
                <td>
                  <div className="flex flex-wrap gap-1 max-w-sm">
                    {member.permissions?.can_view_products && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-400">Voir Catalogue</span>
                    )}
                    {member.permissions?.can_edit_products && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-400">Éditer Catalogue</span>
                    )}
                    {member.permissions?.can_validate_orders && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-cyan-500/15 text-cyan-400">Valider Commandes</span>
                    )}
                    {member.permissions?.can_follow_prospects && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-400">Prospection/CRM</span>
                    )}
                    {member.permissions?.can_view_stocks && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-500/15 text-purple-400">Voir Stocks</span>
                    )}
                    {member.permissions?.can_view_comptabilite && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-500/15 text-indigo-400">Voir Compta.</span>
                    )}
                    {member.role === 'admin' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-rose-500/15 text-rose-400 font-bold">Tous les Droits</span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="flex gap-2">
                    <button onClick={() => handleOpenEdit(member)} className="btn-outline btn-sm" aria-label="Modifier">
                      <Edit2 size={12} />
                    </button>
                    {member.role !== 'admin' && (
                      <button onClick={() => handleDelete(member.id)} className="btn-outline btn-sm text-red-400 hover:bg-red-500/10 border-red-500/20" aria-label="Supprimer">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card max-w-xl w-full max-h-[90vh] overflow-y-auto relative">
            <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/30" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <X size={14} />
            </button>
            <div className="p-6">
              <h3 className="font-display font-extrabold text-lg mb-4 flex items-center gap-2">
                <Shield size={18} className="text-cyan-400" />
                {editingStaff ? 'Modifier le membre' : 'Ajouter un membre du personnel'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="form-label">Nom complet *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="form-input text-sm"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="form-input text-sm"
                    />
                  </div>
                  <div>
                    <label className="form-label">Téléphone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="06XXXXXXXX"
                      className="form-input text-sm"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Rôle *</label>
                    <select
                      value={role}
                      onChange={e => handleRoleChange(e.target.value)}
                      className="form-input text-sm"
                    >
                      <option value="sales">Commercial</option>
                      <option value="technician">Technicien</option>
                      <option value="stock_manager">Gestionnaire de Stock</option>
                      <option value="admin_assistant">Assistante d&apos;Administration</option>
                      <option value="admin">Superadministrateur (Accès Total)</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">
                      {editingStaff ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe *'}
                    </label>
                    <input
                      type="password"
                      required={!editingStaff}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={editingStaff ? 'Conserver le mot de passe actuel' : '••••••••'}
                      className="form-input text-sm"
                    />
                  </div>
                </div>

                {role !== 'admin' && (
                  <div className="border-t border-[color:var(--border)] pt-4">
                    <span className="form-label font-bold block mb-3">Gestion des Droits &amp; Permissions d&apos;Accès</span>
                    <div className="grid sm:grid-cols-2 gap-3 text-xs">
                      <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[color:var(--bg-card)] border border-[color:var(--border)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.can_view_products}
                          onChange={e => setPermissions(p => ({ ...p, can_view_products: e.target.checked }))}
                          className="rounded text-cyan-500 focus:ring-cyan-500 bg-[color:var(--bg-card-hover)]"
                        />
                        <span>Consulter le catalogue</span>
                      </label>
                      <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[color:var(--bg-card)] border border-[color:var(--border)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.can_edit_products}
                          onChange={e => setPermissions(p => ({ ...p, can_edit_products: e.target.checked }))}
                          className="rounded text-cyan-500 focus:ring-cyan-500 bg-[color:var(--bg-card-hover)]"
                        />
                        <span>Modifier/Ajouter des articles</span>
                      </label>
                      <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[color:var(--bg-card)] border border-[color:var(--border)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.can_validate_orders}
                          onChange={e => setPermissions(p => ({ ...p, can_validate_orders: e.target.checked }))}
                          className="rounded text-cyan-500 focus:ring-cyan-500 bg-[color:var(--bg-card-hover)]"
                        />
                        <span>Valider les commandes</span>
                      </label>
                      <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[color:var(--bg-card)] border border-[color:var(--border)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.can_follow_prospects}
                          onChange={e => setPermissions(p => ({ ...p, can_follow_prospects: e.target.checked }))}
                          className="rounded text-cyan-500 focus:ring-cyan-500 bg-[color:var(--bg-card-hover)]"
                        />
                        <span>Suivis de prospection (CRM)</span>
                      </label>
                      <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[color:var(--bg-card)] border border-[color:var(--border)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.can_view_stocks}
                          onChange={e => setPermissions(p => ({ ...p, can_view_stocks: e.target.checked }))}
                          className="rounded text-cyan-500 focus:ring-cyan-500 bg-[color:var(--bg-card-hover)]"
                        />
                        <span>Consulter les stocks</span>
                      </label>
                      <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[color:var(--bg-card)] border border-[color:var(--border)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.can_view_comptabilite}
                          onChange={e => setPermissions(p => ({ ...p, can_view_comptabilite: e.target.checked }))}
                          className="rounded text-cyan-500 focus:ring-cyan-500 bg-[color:var(--bg-card-hover)]"
                        />
                        <span>Consulter la comptabilité</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-[color:var(--border)]">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="btn-outline flex-1 justify-center py-2.5"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary flex-1 justify-center py-2.5"
                  >
                    {submitting ? 'Envoi...' : (editingStaff ? 'Enregistrer' : 'Créer le compte')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
