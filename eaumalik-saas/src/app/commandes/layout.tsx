import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/supabase/server';
import AdminShell from '@/components/admin/AdminShell';

/**
 * Layout partagé entre `/commandes` et `/admin/*` pour afficher la
 * barre latérale d'administration (même menu que le dropdown « Administration »
 * du Navbar). La garde `/admin/*` reste dans `app/admin/layout.tsx` ; ici on
 * accepte tout personnel connecté (la page enfant applique sa propre garde).
 */
export default async function CommandesLayout({ children }: { children: ReactNode }) {
  try {
    await requireUser();
  } catch {
    redirect('/login?callbackUrl=/commandes');
  }
  return <AdminShell title="Administration">{children}</AdminShell>;
}