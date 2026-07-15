'use client';

import { useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Shield, Archive, RotateCcw, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/shared/ToastProvider';
import Dialog from '@/components/ui/Dialog';
import {
  createStaffUserAction,
  updateStaffUserAction,
  deleteStaffUserAction,
  restoreArchivedStaffAction,
  purgeArchivedStaffAction,
} from '@/app/actions/adminActions';
import { formatCurrency } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Superadministrateur',
  administrator: 'Administrateur',
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

type Tab = 'active' | 'archived';

export default function StaffManager({
  initialStaff,
  initialArchived = [],
}: {
  initialStaff: any[];
  initialArchived?: any[];
}) {
  const [staffList, setStaffList] = useState<any[]>(initialStaff);
  const [archivedList, setArchivedList] = useState<any[]>(initialArchived);
  const [tab, setTab] = useState<Tab>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [restoreModal, setRestoreModal] = useState<any | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreSubmitting, setRestoreSubmitting] = useState(false);
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
    } else if (selectedRole === 'administrator') {
      // Administrateur : tous les droits sauf suppression de superadmin
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

  const handleDelete = async (member: any) => {
    if (!confirm(
      `Êtes-vous sûr de vouloir archiver le compte de ${member.full_name} ?\n\n`
      + 'Le compte sera déplacé dans les Archives et pourra y être restauré à tout moment.'
    )) return;

    const res = await deleteStaffUserAction(member.id);
    if (res.success) {
      setStaffList(prev => prev.filter(u => u.id !== member.id));
      // Rafraîchit l'archive (ajout optimiste)
      setArchivedList(prev => [
        {
          id: member.id,
          email: member.email,
          full_name: member.full_name,
          phone: member.phone ?? null,
          role: member.role,
          permissions: member.permissions ?? null,
          original_created_at: member.created_at ?? null,
          original_updated_at: member.updated_at ?? null,
          archived_at: new Date().toISOString(),
          archived_reason: 'Suppression manuelle depuis la gestion du personnel',
        },
        ...prev,
      ]);
      toast('Compte archivé. Récupérable depuis l\'onglet Archives.', 'success');
    } else {
      toast('Erreur : ' + res.error, 'error');
    }
  };

  const openRestore = (member: any) => {
    setRestoreModal(member);
    setRestorePassword('');
  };

  const closeRestore = () => {
    if (restoreSubmitting) return;
    setRestoreModal(null);
    setRestorePassword('');
  };

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreModal || !restorePassword || restoreSubmitting) return;
    setRestoreSubmitting(true);

    const res = await restoreArchivedStaffAction({
      id: restoreModal.id,
      newPassword: restorePassword,
    });

    if (res.success) {
      // Sort le compte de l'archive, l'ajoute aux actifs (état optimiste)
      const restoredMember = {
        id: restoreModal.id,
        email: restoreModal.email,
        full_name: restoreModal.full_name,
        phone: restoreModal.phone ?? '',
        role: restoreModal.role,
        permissions: restoreModal.permissions ?? DEFAULT_PERMISSIONS,
        created_at: restoreModal.original_created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setArchivedList(prev => prev.filter(u => u.id !== restoreModal.id));
      setStaffList(prev => [restoredMember, ...prev]);
      toast('Compte restauré avec succès. Le mot de passe choisi est actif immédiatement.', 'success');
      setRestoreModal(null);
      setRestorePassword('');
      setTab('active');
    } else {
      toast('Erreur : ' + res.error, 'error');
    }
    setRestoreSubmitting(false);
  };

  const handlePurge = async (member: any) => {
    if (!confirm(
      `Supprimer définitivement le compte archivé de ${member.full_name} ?\n\n`
      + 'Cette action est IRRÉVERSIBLE. Le compte ne pourra plus être récupéré.'
    )) return;

    const res = await purgeArchivedStaffAction(member.id);
    if (res.success) {
      setArchivedList(prev => prev.filter(u => u.id !== member.id));
      toast('Compte supprimé définitivement.', 'success');
    } else {
      toast('Erreur : ' + res.error, 'error');
    }
  };

  const counts = useMemo(
    () => ({
      active: staffList.length,
      archived: archivedList.length,
    }),
    [staffList.length, archivedList.length]
  );

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-display font-extrabold text-xl">Gestion du Personnel & Droits</h2>
        {tab === 'active' && (
          <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Ajouter un membre
          </button>
        )}
      </div>

      {/* Onglets Actif / Archives */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => setTab('active')}
            className="px-4 py-2 text-sm font-semibold transition-all flex items-center gap-1.5"
            style={{
              background: tab === 'active' ? 'var(--primary)' : 'transparent',
              color: tab === 'active' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            Actifs ({counts.active})
          </button>
          <button
            type="button"
            onClick={() => setTab('archived')}
            className="px-4 py-2 text-sm font-semibold transition-all flex items-center gap-1.5"
            style={{
              background: tab === 'archived' ? 'var(--primary)' : 'transparent',
              color: tab === 'archived' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <Archive size={12} /> Archives ({counts.archived})
          </button>
        </div>
        <p className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          {tab === 'active'
            ? 'Supprimer un compte le déplace dans les Archives. Restaurez-le à tout moment.'
            : 'Les comptes archivés peuvent être restaurés (avec un nouveau mot de passe) ou supprimés définitivement.'}
        </p>
      </div>

      <div className="glass-card overflow-x-auto" style={{ transform: 'none' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Personnel</th>
              <th>Rôle</th>
              <th>{tab === 'active' ? 'Téléphone' : 'Archivé le'}</th>
              <th>{tab === 'active' ? 'Droits d\'accès' : 'Raison'}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(tab === 'active' ? staffList : archivedList).map(member => (
              <tr key={member.id} className={tab === 'archived' ? 'opacity-70' : ''}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-soft text-primary-light flex items-center justify-center font-bold text-xs">
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
                    member.role === 'admin' ? 'bg-danger-soft text-danger'
                    : member.role === 'administrator' ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-primary-soft text-primary-light'
                  }`}>
                    {ROLE_LABELS[member.role] || member.role}
                  </span>
                </td>
                {tab === 'active' ? (
                  <>
                    <td className="text-sm">{member.phone || '—'}</td>
                    <td>
                      <div className="flex flex-wrap gap-1 max-w-sm">
                        {member.permissions?.can_view_products && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-success-soft text-success">Voir Catalogue</span>
                        )}
                        {member.permissions?.can_edit_products && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-success-soft text-success">Éditer Catalogue</span>
                        )}
                        {member.permissions?.can_validate_orders && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-primary-soft text-primary-light">Valider Commandes</span>
                        )}
                        {member.permissions?.can_follow_prospects && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-warning-soft text-warning">Prospection/CRM</span>
                        )}
                        {member.permissions?.can_view_stocks && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-500/15 text-purple-400">Voir Stocks</span>
                        )}
                        {member.permissions?.can_view_comptabilite && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-500/15 text-indigo-400">Voir Compta.</span>
                        )}
                        {(member.role === 'admin' || member.role === 'administrator') && (
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
                          <button
                            onClick={() => handleDelete(member)}
                            className="btn-outline btn-sm text-danger hover:bg-danger-soft border-danger"
                            aria-label="Archiver"
                            title="Archiver le compte (récupérable)"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="text-xs">
                      {member.archived_at
                        ? new Date(member.archived_at).toLocaleString('fr-FR', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {member.archived_reason || '—'}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openRestore(member)}
                          className="btn-outline btn-sm"
                          aria-label="Restaurer"
                          title="Restaurer ce compte (nouveau mot de passe requis)"
                          style={{ borderColor: 'var(--success, #10b981)', color: 'var(--success, #10b981)' }}
                        >
                          <RotateCcw size={12} />
                        </button>
                        <button
                          onClick={() => handlePurge(member)}
                          className="btn-outline btn-sm text-danger hover:bg-danger-soft border-danger"
                          aria-label="Supprimer définitivement"
                          title="Supprimer définitivement (irréversible)"
                        >
                          <AlertTriangle size={12} />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {tab === 'active' && staffList.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
                  Aucun membre du personnel enregistré.
                </td>
              </tr>
            )}
            {tab === 'archived' && archivedList.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
                  <Archive size={20} className="inline-block mr-2 opacity-50" />
                  Aucune archive. Les comptes supprimés apparaîtront ici.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingStaff ? 'Modifier le membre' : 'Ajouter un membre du personnel'}
        icon={<Shield size={18} />}
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-outline flex-1 justify-center py-2.5"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="staff-form"
              disabled={submitting}
              className="btn-primary flex-1 justify-center py-2.5"
            >
              {submitting ? 'Envoi...' : (editingStaff ? 'Enregistrer' : 'Créer le compte')}
            </button>
          </>
        }
      >
              <form id="staff-form" onSubmit={handleSubmit} className="space-y-4">
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
                      <option value="administrator">Administrateur (Droits Étendus)</option>
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

                {role !== 'admin' && role !== 'administrator' && (
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
              </form>
      </Dialog>

      {/* Modal de restauration (nouveau mot de passe obligatoire) */}
      <Dialog
        open={!!restoreModal}
        onClose={closeRestore}
        title="Restaurer le compte"
        subtitle={restoreModal ? `Le compte de ${restoreModal.full_name} (${restoreModal.email}) sera réactivé avec un nouveau mot de passe. Rôle restauré : ${ROLE_LABELS[restoreModal.role] || restoreModal.role}.` : undefined}
        icon={<RotateCcw size={18} />}
        size="sm"
        dismissible={!restoreSubmitting}
        footer={
          <>
            <button
              type="button"
              onClick={closeRestore}
              disabled={restoreSubmitting}
              className="btn-outline flex-1 justify-center py-2.5"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="restore-form"
              disabled={restoreSubmitting || restorePassword.length < 8}
              className="btn-primary flex-1 justify-center py-2.5"
            >
              {restoreSubmitting ? 'Restauration...' : 'Restaurer le compte'}
            </button>
          </>
        }
      >
        <form id="restore-form" onSubmit={handleRestore} className="space-y-4">
          <div>
            <label className="form-label">
              Nouveau mot de passe <span className="text-danger">*</span>
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={restorePassword}
              onChange={e => setRestorePassword(e.target.value)}
              placeholder="Min. 8 caractères, 1 majuscule, 1 chiffre"
              className="form-input text-sm"
              autoFocus
              disabled={restoreSubmitting}
            />
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Le mot de passe d&apos;origine n&apos;est pas conservé pour des raisons de sécurité.
              Communiquez-le au membre après la restauration.
            </p>
          </div>
        </form>
      </Dialog>
    </>
  );
}
