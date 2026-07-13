import { listMaintenanceRecords } from '@/data/repositories';
import MaintenanceTable from '@/components/admin/MaintenanceTable';
import type { MaintenanceRecord } from '@/types';

export const dynamic = 'force-dynamic';

export default async function AdminMaintenancePage() {
  const records = await listMaintenanceRecords();
  return <MaintenanceTable initialRecords={records as MaintenanceRecord[]} />;
}
