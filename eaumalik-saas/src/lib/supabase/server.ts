/**
 * Client Supabase côté serveur (Server Components, Route Handlers, Server Actions).
 * Lit les cookies via next/headers pour propager la session.
 *
 * Helpers d'autorisation requireUser/requireAdmin/AuthError ajoutés pour
 * remplacer next-auth (cf. audit). Le rôle est lu depuis le profil public.users
 * tant que le claim `role` n'a pas été injecté dans le JWT via le trigger.
 */
import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.trim() === '' || key.trim() === '') {
    throw new Error('Supabase env manquante côté serveur.');
  }

  const cookieStore = cookies();

  return createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // In Server Components, cookie writes are no-op (use middleware or Server Actions).
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {}
      },
    },
  });
}

/**
 * Service Role — BYPASS RLS. N'importe jamais ce module depuis un fichier 'use client'.
 * L'import 'server-only' ci-dessus fait échouer le build côté client si tenté.
 */
export function createSupabaseServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || url.trim() === '' || key.trim() === '') {
    throw new Error('Service Role key manquante.');
  }

  // require() dynamique OK côté serveur ; non exporté vers le client via 'server-only'.
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Erreur typée pour les problèmes d'authentification/autorisation. */
export class AuthError extends Error {
  status: 401 | 403;
  code: 'unauthenticated' | 'forbidden';
  constructor(code: 'unauthenticated' | 'forbidden', message: string) {
    super(message);
    this.code = code;
    this.status = code === 'unauthenticated' ? 401 : 403;
  }
}

export interface AuthUser {
  id: string;
  email: string;
  role: 'client' | 'admin';
  full_name: string | null;
}

/**
 * Lit la session dev (mode mock) depuis le cookie httpOnly pose par
 * /api/auth/dev-login, ou retourne null si pas en mode dev.
 */
async function getDevUserFromCookie(): Promise<AuthUser | null> {
  if (process.env.NEXT_PUBLIC_USE_MOCKS !== 'true') return null;
  const hasEnv =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (hasEnv) return null; // mode Supabase reel : on ne court-circuite pas

  try {
    const { cookies } = await import('next/headers');
    const store = cookies();
    const raw = store.get('eaumalik_dev_session')?.value;
    if (!raw) return null;
    const u = JSON.parse(raw);
    return {
      id: u.id,
      email: u.email,
      role: u.role === 'admin' ? 'admin' : 'client',
      full_name: u.full_name ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Renvoie l'utilisateur authentifie via Supabase Auth (ou session dev en mode mock),
 * ou jette AuthError(401).
 */
export async function requireUser(): Promise<AuthUser> {
  const dev = await getDevUserFromCookie();
  if (dev) return dev;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new AuthError('unauthenticated', 'Authentification requise.');
  }
  const user = data.user;
  const { data: profile } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .single();
  return {
    id: user.id,
    email: user.email ?? '',
    role: (profile?.role as 'client' | 'admin') ?? 'client',
    full_name: profile?.full_name ?? null,
  };
}

/** Renvoie l'utilisateur authentifie OU null (sans throw). */
export async function getOptionalUser(): Promise<AuthUser | null> {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

/** Renvoie l'utilisateur authentifie si admin, sinon throw AuthError(403). */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== 'admin') {
    throw new AuthError('forbidden', 'Droits administrateur requis.');
  }
  return user;
}
