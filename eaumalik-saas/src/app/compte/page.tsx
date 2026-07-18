import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/supabase/server';
import PasswordChangeForm from '@/components/shared/PasswordChangeForm';

export const metadata = { title: 'Sécurité du compte — EAUMALIK' };

export default async function AccountPage() {
  try {
    await requireUser();
  } catch {
    redirect('/login?callbackUrl=/compte');
  }
  return (
    <div className="pt-4 min-h-[calc(100vh-4rem)]">
      <PasswordChangeForm />
    </div>
  );
}
