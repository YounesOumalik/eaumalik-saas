import { listMaintenance } from '@/data/repositories';
import MaintenanceAlerts from '@/components/crm/MaintenanceAlerts';

export default async function CrmMaintenancePage() {
  const alerts = await listMaintenance();
  return <MaintenanceAlerts initialAlerts={alerts} />;
}
