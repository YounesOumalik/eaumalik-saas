import ClientDashboard from '@/components/client/ClientDashboard';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/supabase/server';
import { getClientDashboardData } from '@/app/actions/clientActions';

export const metadata = {
  title: 'Espace Client — EAUMALIK',
  description: 'Gérez vos alertes de maintenance, parrainages, cashback et communiquez avec le vendeur.',
};

export default async function ClientPage() {
  try {
    await requireUser();
  } catch {
    redirect('/login?callbackUrl=/client');
  }
  const data = await getClientDashboardData();
  if (!data.success || !data.user) {
    redirect('/login');
  }
  return (
    <div className="pt-8 min-h-[calc(100vh-4rem)]">
      <ClientDashboard initialData={data} />
    </div>
  );
}
