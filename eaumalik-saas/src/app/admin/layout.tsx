import type { ReactNode } from 'next';
import AdminShell from '@/components/admin/AdminShell';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell title="Administration">{children}</AdminShell>;
}
