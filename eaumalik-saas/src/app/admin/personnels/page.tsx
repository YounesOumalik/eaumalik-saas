import { readUsersRaw, readArchivedUsersRaw } from '@/data/repositories';
import StaffManager from '@/components/admin/StaffManager';
import { getOptionalUser } from '@/lib/supabase/server';

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

  const currentUser = await getOptionalUser();
  // Rôle réel (« admin » / « administrator » / « client »). `null` si pas
  // connecté. Sert à masquer l'option « Superadministrateur » aux
  // administrators (qui n'ont pas le droit d'élever un autre en superadmin).
  const currentUserRole = (currentUser as any)?.real_role ?? currentUser?.role ?? null;

  return (
    <StaffManager
      initialStaff={staff}
      initialArchived={archived}
      currentUserRole={currentUserRole}
    />
  );
}
