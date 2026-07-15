import { readUsersRaw, readArchivedUsersRaw } from '@/data/repositories';
import StaffManager from '@/components/admin/StaffManager';

export const metadata = {
  title: 'Gestion des Personnels — EAUMALIK',
};

// Empêche le prerender statique : la page a besoin de SUPABASE_SERVICE_ROLE_KEY
// au runtime, pas au build time.
export const dynamic = 'force-dynamic';

export default async function AdminPersonnelsPage() {
  const users = await readUsersRaw();
  const staff = users.filter(u => u.role !== 'client');

  const archived = (await readArchivedUsersRaw())
    .filter(u => u.role !== 'client')
    .sort((a, b) => (b.archived_at || '').localeCompare(a.archived_at || ''));

  return <StaffManager initialStaff={staff} initialArchived={archived} />;
}
