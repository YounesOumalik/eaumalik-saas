/**
 * Middleware Next.js : rafraîchit la session Supabase (RLS) à chaque requête
 * ET protège les routes privées (`/admin/*`, `/crm/*`, `/client/*`) par redirection
 * vers /login si non authentifié.
 *
 * Important : on ne lit que la présence d'un cookie de session pour la redirection,
 * pas le rôle (le rôle est vérifié côté page pour éviter les races entre cookies
 * JWT et helpers de rôle).
 *
 * On expose aussi `x-crm-pathname` dans la réponse pour que les layouts
 * (notamment `/crm/layout.tsx`) puissent reconstruire un `callbackUrl`
 * précis en cas de redirect — utile quand l'utilisateur est renvoyé vers
 * /login après expiration de session au milieu d'une navigation.
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
  // Expose le pathname courant aux Server Components (utile pour /crm/layout
  // qui doit reconstruire un callbackUrl précis quand il redirige vers /login).
  // On passe par `request.headers` (forwardé au RSC) pour ne pas dépendre
  // d'une extension propriétaire.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-crm-pathname', request.nextUrl.pathname + request.nextUrl.search);

  // Pré-crée la réponse pour pouvoir modifier ses headers/cookies.
  let response = NextResponse.next({ request: { headers: requestHeaders } });

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
        response = NextResponse.next({ request: { headers: requestHeaders } });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options });
        response = NextResponse.next({ request: { headers: requestHeaders } });
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  // Rafraîchit le token si nécessaire.
  // Note : getUser() peut lever/renvoyer une erreur "Unauthorized" (401) si la
  // session est absente ou expirée. On catche pour ne pas casser le rendu des
  // pages publiques (landing, boutique, ...) qui tolèrent l'absence d'utilisateur.
  let isAuthed = false;
  try {
    const { data } = await supabase.auth.getUser();
    isAuthed = !!data.user;
  } catch {
    isAuthed = false;
  }

  // Protection des routes privées.
  if (isProtected(request.nextUrl.pathname) && !isAuthed) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname + request.nextUrl.search);
    const redirect = NextResponse.redirect(loginUrl);
    return redirect;
  }

  // Redirection vers google-complete si l'utilisateur est connecté mais son
  // profil est incomplet (téléphone/ville manquants après connexion Google).
  if (
    isAuthed &&
    !request.nextUrl.pathname.startsWith('/login/google-complete') &&
    !request.nextUrl.pathname.startsWith('/login')
  ) {
    try {
      const { data: profile } = await supabase
        .from('user_profile_complete')
        .select('is_complete')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();
      if (profile && !profile.is_complete) {
        const completeUrl = new URL('/login/google-complete', request.url);
        completeUrl.searchParams.set('callbackUrl', request.nextUrl.pathname + request.nextUrl.search);
        return NextResponse.redirect(completeUrl);
      }
    } catch {
      // En cas d'erreur (vue absente, RLS), on laisse passer.
    }
  }

  return response;
}
