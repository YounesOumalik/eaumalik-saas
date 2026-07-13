import { readUsers, readArchivedUsers } from '@/data/localDb';
import StaffManager from '@/components/admin/StaffManager';

export const metadata = {
  title: 'Gestion des Personnels — EAUMALIK',
};

export default async function AdminPersonnelsPage() {
  const users = readUsers();
  const staff = users.filter(u => u.role !== 'client');

  const archived = readArchivedUsers()
    .filter(u => u.role !== 'client')
    .sort((a, b) => (b.archived_at || '').localeCompare(a.archived_at || ''));

  return <StaffManager initialStaff={staff} initialArchived={archived} />;
}
