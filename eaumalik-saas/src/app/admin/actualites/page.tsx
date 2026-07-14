import { redirect } from 'next/navigation';

/**
 * Compatibilité ascendante — l'ancienne route `/admin/actualites` (gestion
 * CRUD des actualités via NewsManager) redirige vers la nouvelle page unifiée
 * `/admin/publications` qui inclut désormais la publication ET la messagerie.
 *
 * À supprimer une fois tous les bookmarks/liens internes migrés.
 */
export default function AdminActualitesRedirect() {
  redirect('/admin/publications');
}
