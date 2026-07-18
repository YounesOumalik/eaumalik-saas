'use client';

import { usePathname } from 'next/navigation';

const ADMIN_PATH_PREFIXES = ['/admin', '/crm', '/commandes'] as const;

export default function FooterVisibility({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hidden = ADMIN_PATH_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  return hidden ? null : <>{children}</>;
}
