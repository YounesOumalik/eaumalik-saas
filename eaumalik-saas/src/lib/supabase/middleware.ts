/**
 * Middleware Next.js : rafraîchit la session Supabase (RLS) à chaque requête
 * ET protège les routes privées (`/admin/*`, `/crm/*`, `/client/*`) par redirection
 * vers /login si non authentifié.
 *
 * Important : on ne lit que la présence d'un cookie de session pour la redirection,
 * pas le rôle (le rôle est vérifié côté page pour éviter les races entre cookies
 * JWT et helpers de rôle).
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_PREFIX = '/admin';
const CRM_PREFIX = '/crm';
const CLIENT_PREFIX = '/client';

function isProtected(pathname: string) {
  return (
    pathname.startsWith(ADMIN_PREFIX) ||
    pathname.startsWith(CRM_PREFIX) ||
    pathname.startsWith(CLIENT_PREFIX)
  );
}

export async function updateSupabaseSession(request: NextRequest) {
  // Pré-crée la réponse pour pouvoir modifier ses headers/cookies.
  let response = NextResponse.next({ request: { headers: request.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Si pas d'env configurée, on ne peut rien faire — laisse passer (mode mock).
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  // Rafraîchit le token si nécessaire.
  const { data } = await supabase.auth.getUser();
  const isAuthed = !!data.user;

  // Protection des routes privées.
  if (isProtected(request.nextUrl.pathname) && !isAuthed) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname + request.nextUrl.search);
    const redirect = NextResponse.redirect(loginUrl);
    return redirect;
  }

  return response;
}
