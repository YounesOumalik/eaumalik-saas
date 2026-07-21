// filepath: src/lib/adminNav.ts
/**
 * Source de vérité unique pour la navigation d'administration.
 *
 * Cette liste alimente à la fois :
 *   - la barre latérale (AdminShell)
 *   - le menu déroulant "Administration" du Navbar
 *
 * Toute modification (libellé, lien, permission, ajout/suppression) est
 * automatiquement reflétée dans les deux composants. Les icônes restent
 * locales à chaque composant (un Chevron dans le dropdown, des icônes
 * Lucide dans la sidebar) pour préserver la cohérence visuelle de
 * chaque contexte.
 */

export type AdminNavScope = 'admin' | 'global';

export type AdminPermissionKey =
  | 'can_view_stocks'
  | 'can_view_products'
  | 'can_view_comptabilite'
  | 'can_follow_prospects';

export type AdminNavItem = {
  /** Identifiant technique stable, utilisé comme `data-tab` et clé React. */
  id: string;
  /** Libellé affiché à l'utilisateur. */
  label: string;
  /** Route cible. */
  href: string;
  /**
   * Périmètre de la page :
   *   - 'admin'  → vit sous le layout /admin ou /crm (barre latérale visible)
   *   - 'global' → page autonome (/commandes), hors du shell admin
   * Le dropdown global du Navbar consomme tout ; la sidebar filtre `admin`.
   */
  scope: AdminNavScope;
  /** Si défini à 'admin', l'entrée n'apparaît QUE pour les superadmins.
   *  Si défini à 'admin-staff', l'entrée apparaît pour les superadmins ET les
   *  administrateurs (Administrateur « Droits Étendus »). */
  requiredRole?: 'admin' | 'admin-staff';
  /** Entrée réservée aux rôles métier non-client. */
  staffOnly?: boolean;
  /** Permission Supabase nécessaire à l'affichage (ignoré si l'utilisateur est admin). */
  permissionKey?: AdminPermissionKey;
};

export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  {
    id: 'commandes',
    label: 'Commandes',
    href: '/commandes',
    scope: 'global',
    staffOnly: true,
  },
  {
    id: 'stocks',
    label: 'Stocks',
    href: '/admin/stocks',
    scope: 'admin',
    permissionKey: 'can_view_stocks',
  },
  {
    id: 'catalogue',
    label: 'Catalogue',
    href: '/admin/catalogue',
    scope: 'admin',
    permissionKey: 'can_view_products',
  },
  {
    id: 'comptabilite',
    label: 'Comptabilité',
    href: '/admin/comptabilite',
    scope: 'admin',
    permissionKey: 'can_view_comptabilite',
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    href: '/admin/maintenance',
    scope: 'admin',
    permissionKey: 'can_view_comptabilite',
  },
  {
    id: 'clients',
    label: 'Clients',
    href: '/crm/clients',
    scope: 'admin',
    permissionKey: 'can_follow_prospects',
  },
  {
    id: 'publications',
    label: 'Publier Actualité',
    href: '/admin/publications',
    scope: 'admin',
    requiredRole: 'admin-staff',
  },
  {
    id: 'personnels',
    label: 'Personnels',
    href: '/admin/personnels',
    scope: 'admin',
    requiredRole: 'admin-staff',
  },
];

export type AdminScopeFilter = AdminNavScope | 'all';

export type AdminPermissionsBag = Partial<Record<AdminPermissionKey, boolean>>;

/**
 * Filtre la liste de navigation selon le rôle et les permissions de
 * l'utilisateur courant.
 *
 * Règles :
 *   - Le superadmin ('admin') voit tout (règle d'or : pas de granularité).
 *   - L'administrateur « Droits Étendus » ('administrator') voit TOUT sauf
 *     les sections superadmin-only (requiredRole === 'admin'). Comme il a
 *     déjà les pleins pouvoirs côté RLS (effectivePermissions force tout à
 *     true), il n'a pas besoin d'avoir la permission explicite.
 *   - Pour les autres rôles (sales, technician, stock_manager,
 *     admin_assistant, …) les entrées sont filtrées par `permissionKey`.
 *     Une permission doit être explicitement `true`.
 *   - `requiredRole === 'admin'` masque l'entrée aux non-superadmins.
 *   - `requiredRole === 'admin-staff'` la rend visible aux superadmins ET
 *     aux administrators.
 *   - Un client, ou un rôle encore inconnu pendant le chargement, ne reçoit
 *     aucune entrée du personnel (principe du moindre privilège).
 *   - Pour un rôle staff identifié, `permissions=null` conserve les entrées
 *     pendant le court chargement de ses permissions.
 */
export function filterAdminNavItems(
  items: readonly AdminNavItem[],
  role: string | null | undefined,
  permissions: AdminPermissionsBag | null,
  scope: AdminScopeFilter = 'all',
): AdminNavItem[] {
  // Toute cette liste appartient à l'espace personnel. Un client ne doit
  // jamais en voir une entrée ; un rôle inconnu est traité comme client
  // jusqu'à ce que son profil soit effectivement chargé.
  if (!role || role === 'client') return [];

  const isAdmin = role === 'admin';
  // Admin-staff = superadmin OU administrator (Droits Étendus, sans pouvoir
  // supprimer le superadmin).
  const isAdminStaff = role === 'admin' || role === 'administrator';
  // Un superadmin OU un administrator voient TOUT (sauf 'admin'-only).
  const seesEverything = isAdminStaff;

  return items.filter(item => {
    if (scope !== 'all' && item.scope !== scope) return false;
    if (item.requiredRole === 'admin' && !isAdmin) return false;
    if (item.requiredRole === 'admin-staff' && !isAdminStaff) return false;
    // Superadmin : tout.
    if (isAdmin) return true;
    // Administrator : tout SAUF si la règle 'admin' l'a coupé (déjà géré
    // au-dessus) ou si la permission explicite est false (cas rare :
    // permissions désactivées par un superadmin sur un administrator).
    if (role === 'administrator') {
      // Pour l'admin « Droits Étendus » on se base sur ses permissions
      // explicites si elles sont chargées, sinon on autorise.
      if (!permissions) return true;
      if (item.permissionKey) return permissions[item.permissionKey] !== false;
      return true;
    }
    // Rôle staff classique : filtrage strict par permission.
    if (seesEverything) return true;
    if (!permissions) return true;
    if (item.permissionKey) return permissions[item.permissionKey] === true;
    return true;
  });
}
