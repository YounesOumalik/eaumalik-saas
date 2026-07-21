'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Edit2, Trash2, Shield, Archive, RotateCcw, AlertTriangle, Mail, MapPin, Warehouse, Store, PackageOpen } from 'lucide-react';
import { useToast } from '@/components/shared/ToastProvider';
import Dialog from '@/components/ui/Dialog';
import {
  createStaffUserAction,
  updateStaffUserAction,
  sendStaffPasswordResetAction,
  deleteStaffUserAction,
  restoreArchivedStaffAction,
  purgeArchivedStaffAction,
} from '@/app/actions/adminActions';
import { listLocationsAction } from '@/app/actions/locationsActions';
import { formatCurrency } from '@/lib/utils';
import type { Location, LocationType } from '@/types';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Superadministrateur',
  administrator: 'Administrateur',
  technician: 'Technicien',
  stock_manager: 'Gestionnaire de Stock',
  sales: 'Commercial',
  admin_assistant: 'Assistante d\'Administration',
  depot_manager: 'Gestionnaire de Dépôt',
  store_manager: 'Gestionnaire de Magasin',
  presentoir_manager: 'Gestionnaire de Présentoir',
};

/** Rôles logistiques qui déclenchent l'affichage du bloc « Localités affectées ». */
const LOGISTICS_ROLES = ['depot_manager', 'store_manager', 'presentoir_manager'] as const;
/** Mapping rôle logistique → type de localité géré (cf. serveur). */
const LOGISTICS_ROLE_TO_TYPE: Record<typeof LOGISTICS_ROLES[number], LocationType> = {
  depot_manager: 'depot',
  store_manager: 'magasin',
  presentoir_manager: 'presentoir',
};
const LOGISTICS_TYPE_LABEL: Record<LocationType, string> = {
  depot: 'dépôts',
  magasin: 'magasins',
  presentoir: 'présentoirs',
};

const DEFAULT_PERMISSIONS = {
  can_view_products: false,
  can_edit_products: false,
  can_validate_orders: false,
  can_follow_prospects: false,
  can_view_comptabilite: false,
  can_view_stocks: false,
  // Logistique (migration 0014_locations.sql) — false par défaut, l'admin les coche.
  can_view_locations: false,
  can_manage_locations: false,
};

type Tab = 'active' | 'archived';

export default function StaffManager({
  initialStaff,
  initialArchived = [],
  currentUserRole = null,
  currentUserId = null,
}: {
  initialStaff: any[];
  initialArchived?: any[];
  /** Rôle réel de l'utilisateur connecté. Sert à masquer l'option
   *  « Superadministrateur » aux administrators (qui n'ont pas le droit
   *  d'élever quelqu'un en superadmin — seul un superadmin le peut). */
  currentUserRole?: string | null;
  /** ID de l'utilisateur connecté. Sert à filtrer la ligne du Superadmin et
   *  à masquer le bouton d'archivage sur le propre compte de l'utilisateur
   *  connecté (auto-suppression interdite). */
  currentUserId?: string | null;
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
  const [managedLocationIds, setManagedLocationIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState<string | null>(null);

  // Catalogue de localités affichées dans le multi-select du formulaire.
  // Chargé à l'ouverture de la modale + à chaque changement de rôle logistique
  // (car le type change → on filtre sur un autre set).
  const [availableLocations, setAvailableLocations] = useState<Location[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);

  const toast = useToast();

  const handleOpenCreate = () => {
    setEditingStaff(null);
    setEmail('');
    setFullName('');
    setPhone('');
    setRole('sales');
    setPassword('');
    setManagedLocationIds([]);
    setPermissions({
      can_view_products: true,
      can_edit_products: false,
      can_validate_orders: true,
      can_follow_prospects: true,
      can_view_comptabilite: false,
      can_view_stocks: false,
      can_view_locations: false,
      can_manage_locations: false,
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
    setManagedLocationIds(Array.isArray(member.managed_location_ids) ? member.managed_location_ids : []);
    setModalOpen(true);
  };

  /**
   * Change le rôle et suggère une matrice de permissions par défaut.
   *
   * Non-mutatif : si l'admin a déjà coché/décoché manuellement des cases
   * depuis la dernière suggestion, on lui demande confirmation avant
   * d'écraser ses choix (sinon on conserve ce qu'il a fait). Cela évite
   * le pattern précédent où `handleRoleChange` réinitialisait
   * silencieusement les toggles.
   */
  const handleRoleChange = (selectedRole: string) => {
    if (selectedRole === role) return;

    const suggested = permissionsForRole(selectedRole);
    const currentlyEdited = JSON.stringify(permissions) !== JSON.stringify(permissionsForRole(role));
    if (currentlyEdited) {
      const accept = window.confirm(
        'Vous avez modifié manuellement les permissions. '
          + 'Changer de rôle va les réinitialiser selon le modèle standard pour « '
          + (ROLE_LABELS[selectedRole] || selectedRole)
          + ' ». Continuer ?'
      );
      if (!accept) return;
    }
    setRole(selectedRole);
    setPermissions(suggested);
  };

  /** Matrice par défaut pour un rôle donné (utilisée aussi à l'init). */
  function permissionsForRole(r: string) {
    if (r === 'admin') {
      return {
        can_view_products: true, can_edit_products: true,
        can_validate_orders: true, can_follow_prospects: true,
        can_view_comptabilite: true, can_view_stocks: true,
        can_view_locations: true, can_manage_locations: true,
      };
    }
    if (r === 'administrator') {
      return {
        can_view_products: true, can_edit_products: true,
        can_validate_orders: true, can_follow_prospects: true,
        can_view_comptabilite: true, can_view_stocks: true,
        can_view_locations: true, can_manage_locations: true,
      };
    }
    if (r === 'technician') {
      return {
        can_view_products: true, can_edit_products: false,
        can_validate_orders: false, can_follow_prospects: false,
        can_view_comptabilite: false, can_view_stocks: true,
        can_view_locations: false, can_manage_locations: false,
      };
    }
    if (r === 'stock_manager') {
      return {
        can_view_products: true, can_edit_products: true,
        can_validate_orders: false, can_follow_prospects: false,
        can_view_comptabilite: false, can_view_stocks: true,
        can_view_locations: true, can_manage_locations: true,
      };
    }
    if (r === 'sales') {
      return {
        can_view_products: true, can_edit_products: false,
        can_validate_orders: true, can_follow_prospects: true,
        can_view_comptabilite: false, can_view_stocks: false,
        can_view_locations: false, can_manage_locations: false,
      };
    }
    if (r === 'admin_assistant') {
      return {
        can_view_products: true, can_edit_products: false,
        can_validate_orders: true, can_follow_prospects: true,
        can_view_comptabilite: false, can_view_stocks: true,
        can_view_locations: true, can_manage_locations: false,
      };
    }
    // Sous-rôles logistiques : le rôle gère ses localités. On suggère
    // view_products + view_locations par défaut ; manage_locations est
    // explicitement cochable par l'admin.
    if (r === 'depot_manager') {
      return {
        can_view_products: true, can_edit_products: false,
        can_validate_orders: false, can_follow_prospects: false,
        can_view_comptabilite: false, can_view_stocks: true,
        can_view_locations: true, can_manage_locations: true,
      };
    }
    if (r === 'store_manager') {
      return {
        can_view_products: true, can_edit_products: false,
        can_validate_orders: true, can_follow_prospects: false,
        can_view_comptabilite: false, can_view_stocks: false,
        can_view_locations: true, can_manage_locations: true,
      };
    }
    if (r === 'presentoir_manager') {
      return {
        can_view_products: true, can_edit_products: false,
        can_validate_orders: false, can_follow_prospects: false,
        can_view_comptabilite: false, can_view_stocks: false,
        can_view_locations: true, can_manage_locations: false,
      };
    }
    return DEFAULT_PERMISSIONS;
  }

  /**
   * Charge les localités filtrées par type quand un rôle logistique est
   * sélectionné (et à l'ouverture de la modale si on édite un profil
   * logistique déjà sauvegardé). Re-fetch à chaque changement de rôle
   * logistique pour actualiser le catalogue.
   */
  useEffect(() => {
    if (!modalOpen) return;
    const isLogistics = (LOGISTICS_ROLES as readonly string[]).includes(role);
    if (!isLogistics) {
      // Rôle non-logistique : on vide le catalogue et reset des affectations
      // (un rôle non-logistique n'a pas de localités à gérer).
      if (managedLocationIds.length > 0) setManagedLocationIds([]);
      setAvailableLocations([]);
      return;
    }
    const wantedType = LOGISTICS_ROLE_TO_TYPE[role as typeof LOGISTICS_ROLES[number]];
    let cancelled = false;
    setLocationsLoading(true);
    listLocationsAction({ type: wantedType, onlyActive: true, includeArchived: false })
      .then((res) => {
        if (cancelled) return;
        if (res.success) setAvailableLocations(res.locations);
        else {
          setAvailableLocations([]);
          toast('Impossible de charger les localités : ' + res.error, 'error');
        }
      })
      .catch(() => {
        if (!cancelled) setAvailableLocations([]);
      })
      .finally(() => {
        if (!cancelled) setLocationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, modalOpen]);

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
        permissions,
        managed_location_ids: managedLocationIds,
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
        password,
        full_name: fullName,
        phone,
        role,
        permissions,
        managed_location_ids: managedLocationIds,
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

  const handlePasswordReset = async (member: any) => {
    if (resetSubmitting || member.id === currentUserId) return;
    if (!confirm(
      `Envoyer un lien de réinitialisation à ${member.full_name} (${member.email}) ?\n\n`
      + 'Le lien expirera après 30 minutes. Vous ne verrez jamais son mot de passe.'
    )) return;

    setResetSubmitting(member.id);
    const res = await sendStaffPasswordResetAction({ id: member.id });
    if (res.success) {
      toast(
        res.delivery === 'mock'
          ? (res.message ?? 'Demande enregistrée en mode démo.')
          : `Lien de réinitialisation envoyé à ${member.email}.`,
        'success',
      );
    } else {
      toast('Erreur : ' + res.error, 'error');
    }
    setResetSubmitting(null);
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

  const isViewerSuperAdmin = currentUserRole === 'admin';
  const isViewerAdministrator = currentUserRole === 'administrator';
  const canResetOtherPasswords = isViewerSuperAdmin || isViewerAdministrator;

  // Un Administrateur (non-super) ne doit pas voir la ligne du Superadmin
  // dans la liste du personnel.
  const visibleStaffList = useMemo(
    () =>
      isViewerAdministrator
        ? staffList.filter((u: any) => u.role !== 'admin')
        : staffList,
    [staffList, isViewerAdministrator]
  );
  const visibleArchivedList = useMemo(
    () =>
      isViewerAdministrator
        ? archivedList.filter((u: any) => u.role !== 'admin')
        : archivedList,
    [archivedList, isViewerAdministrator]
  );

  const counts = useMemo(
    () => ({
      active: visibleStaffList.length,
      archived: visibleArchivedList.length,
    }),
    [visibleStaffList.length, visibleArchivedList.length]
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
            {(tab === 'active' ? visibleStaffList : visibleArchivedList).map(member => (
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
                    : (LOGISTICS_ROLES as readonly string[]).includes(member.role)
                      ? 'bg-emerald-500/15 text-emerald-400'
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
                        {member.role === 'admin' ? (
                          // Superadmin : badge unique « Tous les Droits ».
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-rose-500/15 text-rose-400 font-bold">Tous les Droits</span>
                        ) : member.role === 'administrator' ? (
                          // Administrateur : badge unique « Droits Étendus »,
                          // plus la note « sauf Superadmin » pour clarifier.
                          <>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-400 font-bold">Droits Étendus</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-rose-500/15 text-rose-400">Hors Superadmin</span>
                          </>
                        ) : (
                          // Personnel classique : on liste les permissions activées.
                          <>
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
                            {member.permissions?.can_view_locations && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-400">Voir Localités</span>
                            )}
                            {member.permissions?.can_manage_locations && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-400">Gérer Logistique</span>
                            )}
                            {(LOGISTICS_ROLES as readonly string[]).includes(member.role)
                              && Array.isArray(member.managed_location_ids)
                              && member.managed_location_ids.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-500/15 text-slate-300">
                                {member.managed_location_ids.length} localité{member.managed_location_ids.length > 1 ? 's' : ''}
                              </span>
                            )}
                            {!member.permissions && (
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => handleOpenEdit(member)} className="btn-outline btn-sm" aria-label="Modifier">
                          <Edit2 size={12} />
                        </button>
                        {canResetOtherPasswords && member.id !== currentUserId && (
                          <button
                            onClick={() => handlePasswordReset(member)}
                            disabled={resetSubmitting === member.id}
                            className="btn-outline btn-sm"
                            aria-label="Envoyer un lien de réinitialisation"
                            title="Envoyer un lien de réinitialisation par email"
                          >
                            {resetSubmitting === member.id ? '…' : <Mail size={12} />}
                          </button>
                        )}
                        {/* Bouton Archiver masqué si :
                              - la cible est un superadmin (ne jamais archiver un superadmin),
                              - OU la cible est l'utilisateur connecté lui-même (auto-suppression interdite). */}
                        {member.role !== 'admin' && member.id !== currentUserId && (
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
            {tab === 'active' && visibleStaffList.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
                  Aucun membre du personnel enregistré.
                </td>
              </tr>
            )}
            {tab === 'archived' && visibleArchivedList.length === 0 && (
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
                      <optgroup label="Logistique — gestion des localités">
                        <option value="depot_manager">Gestionnaire de Dépôt</option>
                        <option value="store_manager">Gestionnaire de Magasin</option>
                        <option value="presentoir_manager">Gestionnaire de Présentoir</option>
                      </optgroup>
                      <option value="administrator">Administrateur (Droits Étendus)</option>
                      {currentUserRole === 'admin' && (
                        <option value="admin">Superadministrateur (Accès Total)</option>
                      )}
                    </select>
                  </div>
                  {!editingStaff ? (
                    <div>
                      <label className="form-label">Mot de passe *</label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="form-input text-sm"
                        autoComplete="new-password"
                      />
                    </div>
                  ) : (
                    <div className="rounded-lg border border-[color:var(--border)] p-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      Le mot de passe n’est jamais affiché ni modifié depuis ce formulaire. Utilisez le bouton email de réinitialisation.
                    </div>
                  )}
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
                      <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[color:var(--bg-card)] border border-[color:var(--border)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.can_view_locations}
                          onChange={e => setPermissions(p => ({ ...p, can_view_locations: e.target.checked }))}
                          className="rounded text-cyan-500 focus:ring-cyan-500 bg-[color:var(--bg-card-hover)]"
                        />
                        <span>Consulter les localités</span>
                      </label>
                      <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[color:var(--bg-card)] border border-[color:var(--border)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permissions.can_manage_locations}
                          onChange={e => setPermissions(p => ({ ...p, can_manage_locations: e.target.checked }))}
                          className="rounded text-cyan-500 focus:ring-cyan-500 bg-[color:var(--bg-card-hover)]"
                        />
                        <span>Gérer la logistique (modifications + transferts)</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Bloc « Localités affectées » — visible UNIQUEMENT pour les
                    sous-rôles logistiques (depot/store/presentoir_manager). */}
                {(LOGISTICS_ROLES as readonly string[]).includes(role) && (
                  <div className="border-t border-[color:var(--border)] pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="form-label font-bold flex items-center gap-2">
                        <MapPin size={14} />
                        Localités affectées
                        <span className="text-[10px] font-normal opacity-70">
                          (type : {LOGISTICS_TYPE_LABEL[LOGISTICS_ROLE_TO_TYPE[role as typeof LOGISTICS_ROLES[number]]]})
                        </span>
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {managedLocationIds.length} sélectionnée{managedLocationIds.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    {locationsLoading ? (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Chargement des localités…
                      </p>
                    ) : availableLocations.length === 0 ? (
                      <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs">
                        <AlertTriangle size={14} className="inline-block mr-1.5 -mt-0.5" />
                        Aucune {LOGISTICS_TYPE_LABEL[LOGISTICS_ROLE_TO_TYPE[role as typeof LOGISTICS_ROLES[number]]]} active n&apos;est enregistrée.
                        Vous pouvez en créer depuis <strong>Logistique</strong> (menu latéral) puis revenir affecter ce profil.
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-2 text-xs max-h-56 overflow-y-auto pr-1">
                        {availableLocations.map((loc) => {
                          const checked = managedLocationIds.includes(loc.id);
                          return (
                            <label
                              key={loc.id}
                              className="flex items-center gap-2.5 p-2 rounded-lg bg-[color:var(--bg-card)] border border-[color:var(--border)] cursor-pointer hover:border-cyan-500/40"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setManagedLocationIds((prev) =>
                                      prev.includes(loc.id) ? prev : [...prev, loc.id]
                                    );
                                  } else {
                                    setManagedLocationIds((prev) =>
                                      prev.filter((id) => id !== loc.id)
                                    );
                                  }
                                }}
                                className="rounded text-cyan-500 focus:ring-cyan-500 bg-[color:var(--bg-card-hover)]"
                              />
                              <span className="flex-1 min-w-0">
                                <span className="font-mono text-[10px] opacity-70 mr-1.5">{loc.code}</span>
                                <span className="truncate">{loc.name}</span>
                                {loc.city ? (
                                  <span className="block text-[10px] opacity-60">{loc.city}</span>
                                ) : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {managedLocationIds.length === 0 && availableLocations.length > 0 && (
                      <div className="mt-3 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs flex items-start gap-2">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        <span>
                          Sans localité affectée, ce profil n&apos;aura accès à aucune structure et verra une page vide sur /admin/locations.
                        </span>
                      </div>
                    )}
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
