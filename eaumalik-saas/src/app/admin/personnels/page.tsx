import { readUsers } from '@/data/localDb';
import StaffManager from '@/components/admin/StaffManager';

export const metadata = {
  title: 'Gestion des Personnels — EAUMALIK',
};

export default async function AdminPersonnelsPage() {
  const users = readUsers();
  const staff = users.filter(u => u.role !== 'client');

  return <StaffManager initialStaff={staff} />;
}
