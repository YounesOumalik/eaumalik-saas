import { redirect } from 'next/navigation';

/**
 * Ancienne page « Suivi Commandes » du CRM. L'interface de suivi des commandes
 * est désormais UNIQUE et servie depuis `/commandes` (barre de navigation
 * principale). On redirige pour ne pas casser les marque-pages / liens
 * existants et éviter la duplication d'UI.
 */
export default async function CrmOrdersPage() {
  redirect('/commandes');
}
