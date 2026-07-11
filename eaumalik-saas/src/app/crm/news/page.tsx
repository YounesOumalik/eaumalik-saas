import CrmNews from '@/components/crm/CrmNews';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/supabase/server';

export default async function CrmNewsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect('/login?callbackUrl=/crm/news');
  }
  return <CrmNews />;
}
