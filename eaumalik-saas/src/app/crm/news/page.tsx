import CrmNews from '@/components/crm/CrmNews';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { readUsers } from '@/data/localDb';

export default async function CrmNewsPage() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const users = readUsers();
  const user = users.find(u => u.email === session.user?.email);
  if (!user || (user.role !== 'admin' && !user.permissions?.can_edit_products)) {
    redirect('/login');
  }

  return <CrmNews />;
}
