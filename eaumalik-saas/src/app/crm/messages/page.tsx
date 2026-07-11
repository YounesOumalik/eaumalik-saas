import CrmMessages from '@/components/crm/CrmMessages';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/supabase/server';
import { getAdminMessagesList } from '@/app/actions/clientActions';

export default async function CrmMessagesPage() {
  try {
    await requireAdmin();
    const res = await getAdminMessagesList();
    const clients = res.success ? res.clients : [];
    return <CrmMessages initialClients={clients as any} />;
  } catch {
    redirect('/login?callbackUrl=/crm/messages');
  }
}
