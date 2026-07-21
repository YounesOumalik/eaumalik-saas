import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/supabase/server';
import { listLocations, listProductLocationStock, listTransferRequests } from '@/data/repositories';
import LocationsManager from '@/components/admin/LocationsManager';

/**
 * Page `/admin/locations` — Module Logistique.
 *
 * Accessible aux admin + administrator (validé par `requireAdmin`).
 * Chargement initial côté serveur (Server Component) :
 *  - toutes les localités (actives + archivées)
 *  - le stock par localité
 *  - les 50 dernières demandes de transfert
 * En cas d'erreur (mock corrompu, etc.) on retombe sur des tableaux vides
 * pour ne pas bloquer l'accès.
 */
export const dynamic = 'force-dynamic';

export default async function AdminLocationsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect('/login?callbackUrl=/admin/locations');
  }

  let initialLocations: Awaited<ReturnType<typeof listLocations>> = [];
  let initialStock: Awaited<ReturnType<typeof listProductLocationStock>> = [];
  let initialTransfers: Awaited<ReturnType<typeof listTransferRequests>> = [];

  try {
    initialLocations = await listLocations({ includeArchived: true });
  } catch {
    initialLocations = [];
  }
  try {
    initialStock = await listProductLocationStock();
  } catch {
    initialStock = [];
  }
  try {
    initialTransfers = (await listTransferRequests()).slice(0, 50);
  } catch {
    initialTransfers = [];
  }

  return (
    <LocationsManager
      initialLocations={initialLocations}
      initialStock={initialStock}
      initialTransfers={initialTransfers}
    />
  );
}