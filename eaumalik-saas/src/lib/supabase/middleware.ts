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
import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_COOKIE_OPTIONS } from './cookies';
import { relativeRedirectLocation } from '../relative-redirect';

const ADMIN_PREFIX = '/admin';
const CRM_PREFIX = '/crm';
const CLIENT_PREFIX = '/client';
const COMMANDES_PREFIX = '/commandes';

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isProtected(pathname: string) {
  return [ADMIN_PREFIX, CRM_PREFIX, CLIENT_PREFIX, COMMANDES_PREFIX]
    .some(prefix => matchesPrefix(pathname, prefix));
}

function hasSupabaseSessionCookie(request: NextRequest) {
  const baseName = SUPABASE_COOKIE_OPTIONS.name;
  return request.cookies.getAll().some(({ name }) =>
    name === baseName || name.startsWith(`${baseName}.`)
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
  const pathname = request.nextUrl.pathname;
  const protectedRoute = isProtected(pathname);

  // La route de déconnexion doit rester purement locale et immédiate : elle
  // efface elle-même les cookies puis redirige vers /login.
  if (pathname === '/api/auth/logout') return response;

  const pendingCookies: Parameters<SetAllCookies>[0] = [];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Si pas d'env configurée, on ne peut rien faire — laisse passer (mode mock).
  if (!url || !key) return response;

  const redirectToLogin = () =>
    new NextResponse(null, {
      status: 307,
      headers: {
        Location: relativeRedirectLocation('/login', {
          callbackUrl: request.nextUrl.pathname + request.nextUrl.search,
        }),
      },
    });

  // Visiteur anonyme : aucun appel réseau Supabase n'est nécessaire. Cela
  // accélère fortement l'accueil, la boutique et la page de connexion, tout
  // en redirigeant immédiatement les routes privées.
  if (!hasSupabaseSessionCookie(request)) {
    return protectedRoute ? redirectToLogin() : response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        pendingCookies.push(...cookiesToSet);
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        });
      },
    },
    cookieOptions: SUPABASE_COOKIE_OPTIONS,
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

  const withSessionCookies = (redirect: NextResponse) => {
    pendingCookies.forEach(({ name, value, options }) =>
      redirect.cookies.set({ name, value, ...options })
    );
    return redirect;
  };

  // Protection des routes privées. Keep Location relative: request.url may
  // contain Docker's bind address (0.0.0.0:3100) behind a reverse proxy.
  if (protectedRoute && !isAuthed) {
    return withSessionCookies(redirectToLogin());
  }

  // Le contrôle de profil Google vit dans /login/google-complete, destination
  // obligatoire du callback OAuth. Le refaire ici ajoutait une requête DB à
  // chaque navigation authentifiée et ralentissait tout l'espace connecté.

  return response;
}
