import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/supabase/server';
import AdminShell from '@/components/admin/AdminShell';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Garde serveur : seul un admin peut voir les segments /admin/*.
  // Le middleware redirige déjà vers /login si non authentifié,
  // mais on revérifie ici pour interdire les comptes clients connectés.
  try {
    await requireAdmin();
  } catch {
    redirect('/login?callbackUrl=/admin');
  }
  return <AdminShell title="Administration">{children}</AdminShell>;
}
