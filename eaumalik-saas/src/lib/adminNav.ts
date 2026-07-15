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
  /** Permission Supabase nécessaire à l'affichage (ignoré si l'utilisateur est admin). */
  permissionKey?: AdminPermissionKey;
};

export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  {
    id: 'commandes',
    label: 'Commandes',
    href: '/commandes',
    scope: 'global',
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
 *   - Les administrateurs voient tout (règle d'or : pas de granularité).
 *   - `requiredRole === 'admin'` masque l'entrée aux non-admins.
 *   - `permissionKey` est requis et doit être explicitement `true`.
 *   - Si `permissions` est `null` (chargement en cours), on reste
 *     optimiste : on affiche tout pour ne pas faire clignoter le menu.
 */
export function filterAdminNavItems(
  items: readonly AdminNavItem[],
  role: string | null | undefined,
  permissions: AdminPermissionsBag | null,
  scope: AdminScopeFilter = 'all',
): AdminNavItem[] {
  const isAdmin = role === 'admin';
  // Admin-staff = superadmin OU administrator (Droits Étendus, sans pouvoir
  // supprimer le superadmin).
  const isAdminStaff = role === 'admin' || role === 'administrator';

  return items.filter(item => {
    if (scope !== 'all' && item.scope !== scope) return false;
    if (item.requiredRole === 'admin' && !isAdmin) return false;
    if (item.requiredRole === 'admin-staff' && !isAdminStaff) return false;
    if (isAdmin) return true;
    if (!permissions) return true;
    if (item.permissionKey) return permissions[item.permissionKey] === true;
    return true;
  });
}