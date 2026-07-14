import { redirect } from 'next/navigation';

/**
 * Redirection de l'ancienne route CRM `/crm/news` (Publier Actualité)
 * vers la nouvelle page unifiée `/admin/publications` qui regroupe
 * publication d'actualités + réponse aux messages clients.
 */
export default function CrmNewsRedirect() {
  redirect('/admin/publications');
}
