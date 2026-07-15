/**
 * Client Supabase côté serveur (Server Components, Route Handlers, Server Actions).
 * Lit les cookies via next/headers pour propager la session.
 *
 * Helpers d'autorisation requireUser/requireAdmin/AuthError : remplacent
 * l'ancien next-auth (cf. audit). Le rôle est lu depuis le profil public.users
 * via la fonction SQL `eaumalik.is_admin()` (pas de claim `role` injecté dans le JWT).
 */
import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { getDevUserFromCookie } from '@/lib/auth/devSession';

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
  /** Rôle métier réel (admin, administrator, client, technician, sales, stock_manager, admin_assistant…)
   *  En mode dev/mock, préservé depuis le cookie. Pour Supabase Auth réel, lu depuis la table users. */
  real_role?: string;
  permissions?: Record<string, boolean> | null;
}

/**Renvoie l'utilisateur authentifie via Supabase Auth (ou session dev en mode mock),
 * ou jete AuthError(401).
 */
export async function requireUser(): Promise<AuthUser> {
  const dev = await getDevUserFromCookie();
  if (dev) {
    // Le helper dev préserve le rôle métier réel ; on le normalise ici en
    // 'admin' | 'client' pour l'API d'autorisation (requireAdmin, etc.) mais
    // on expose aussi `real_role` + `permissions` pour les gates par permission.
    return {
      id: dev.id,
      email: dev.email,
      role: (dev.role === 'admin' || dev.role === 'administrator') ? 'admin' : 'client',
      real_role: dev.role,
      permissions: dev.permissions ?? null,
      full_name: dev.full_name,
    };
  }

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
  const dbRole = profile?.role ?? 'client';
  return {
    id: user.id,
    email: user.email ?? '',
    role: (dbRole === 'admin' || dbRole === 'administrator') ? 'admin' : 'client',
    real_role: dbRole,
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

/** Renvoie les permissions effectives (admin = tout, sinon les booleens du profil). */
function effectivePermissions(user: AuthUser): Record<string, boolean> {
  const isAdmin = user.role === 'admin';
  const p = (user.permissions ?? {}) as Record<string, boolean>;
  const out: Record<string, boolean> = {};
  for (const k of [
    'can_view_products',
    'can_edit_products',
    'can_validate_orders',
    'can_follow_prospects',
    'can_view_comptabilite',
    'can_view_stocks',
  ]) {
    // Admin : toujours true. Sinon : valeur explicite du profil (false / true),
    // fallback à false si non renseigne. On n'utilise plus `?? isAdmin` qui
    // laissait passer un `false` explicite quand meme (cf. user admin seed
    // avec permissions=false) — comportement désormais attendu et cohérent.
    out[k] = isAdmin ? true : p[k] === true;
  }
  return out;
}

/**
 * Gate par permission : exige un utilisateur authentifie (admin OU ayant la
 * permission demandée), sinon throw AuthError(403).
 *
 * Utilisé par les pages /crm/* pour accepter aussi du personnel non-admin
 * (sales, technician…) lorsqu'il dispose de la permission correspondante.
 */
export async function requirePermission(permission: keyof ReturnType<typeof effectivePermissions>): Promise<AuthUser> {
  const user = await requireUser();
  const perms = effectivePermissions(user);
  if (!perms[permission]) {
    throw new AuthError('forbidden', `Permission requise : ${permission}.`);
  }
  return user;
}

export { effectivePermissions };
