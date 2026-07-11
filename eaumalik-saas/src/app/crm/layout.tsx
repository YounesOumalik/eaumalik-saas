import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/supabase/server';
import CrmShell from '@/components/crm/CrmShell';

export default async function CrmLayout({ children }: { children: ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    redirect('/login?callbackUrl=/crm');
  }
  return <CrmShell>{children}</CrmShell>;
}
