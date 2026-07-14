import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/supabase/server';
import { listMaintenance } from '@/data/repositories';
import MaintenanceAlerts from '@/components/crm/MaintenanceAlerts';

/**
 * Page Maintenance Filtres — accessible à l'admin OU à tout personnel disposant
 * de la permission `can_view_products`. Avant ce fix, l'accès était forcement
 * `requireAdmin()` via le layout, ce qui bloquait les profils non-admin.
 */
export default async function CrmMaintenancePage() {
  try {
    await requirePermission('can_view_products');
  } catch {
    redirect('/login?callbackUrl=/crm');
  }
  const alerts = await listMaintenance();
  return <MaintenanceAlerts initialAlerts={alerts} />;
}
