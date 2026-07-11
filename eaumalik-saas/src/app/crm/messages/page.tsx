import { getAdminMessagesList } from '@/app/actions/clientActions';
import CrmMessages from '@/components/crm/CrmMessages';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { readUsers } from '@/data/localDb';

export default async function CrmMessagesPage() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const users = readUsers();
  const user = users.find(u => u.email === session.user?.email);
  if (!user || (user.role !== 'admin' && !user.permissions?.can_follow_prospects)) {
    redirect('/login');
  }

  const res = await getAdminMessagesList();
  const clients = res.success ? res.clients : [];

  return <CrmMessages initialClients={clients as any} />;
}
