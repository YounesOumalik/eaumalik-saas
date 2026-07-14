import 'server-only';

/**
 * Helpers de session pour le mode dev/mock (sans Supabase).
 * La session est portée par un cookie httpOnly `eaumalik_dev_session`
 * posé par /api/auth/dev-login. Contrairement à sessionStorage, le cookie
 * est partagé entre tous les onglets et survit à un refresh de page.
 */

export interface DevUser {
  id: string;
  email: string;
  /** Rôle réel (admin, client, technician, stock_manager, sales, admin_assistant…). */
  role: string;
  full_name: string | null;
  permissions?: Record<string, boolean> | null;
}

/**
 * Lit la session dev (mode mock) depuis le cookie httpOnly posé par
 * /api/auth/dev-login, ou retourne null si pas en mode dev.
 * Préserve le rôle métier réel (pas seulement admin/client) afin que l'UI
 * puisse afficher le menu CRM en fonction des permissions effectives.
 */
export async function getDevUserFromCookie(): Promise<DevUser | null> {
  if (process.env.NEXT_PUBLIC_USE_MOCKS !== 'true') return null;
  const hasEnv =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (hasEnv) return null; // mode Supabase réel : on ne court-circuite pas

  try {
    const { cookies } = await import('next/headers');
    const store = cookies();
    const raw = store.get('eaumalik_dev_session')?.value;
    if (!raw) return null;
    const u = JSON.parse(raw);
    return {
      id: u.id,
      email: u.email,
      role: u.role ?? 'client',
      full_name: u.full_name ?? null,
      permissions: u.permissions ?? null,
    };
  } catch {
    return null;
  }
}

/** Vrai si on est en mode mock/dev (pas de Supabase configuré). */
export function isDevMockMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_USE_MOCKS === 'true' ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

/** Efface le cookie de session dev (déconnexion mode mock). */
export function clearDevSessionCookie(res: {
  cookies: {
    set: (opts: {
      name: string;
      value: string;
      httpOnly: boolean;
      sameSite: 'lax' | 'strict' | 'none';
      path: string;
      maxAge: number;
    }) => void;
  };
}) {
  res.cookies.set({
    name: 'eaumalik_dev_session',
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
