import { NextResponse, type NextRequest } from 'next/server';
import { safeCallbackPath } from './navigation';
import { browserSafeRequestOrigin } from './request-origin';

type SearchValue = string | number | boolean | null | undefined;

/**
 * Return a relative Location header so Next.js never replaces the public host
 * with its internal bind address (for example 0.0.0.0 inside Docker).
 *
 * Ce helper retourne une Location RELATIVE. Il ne doit PAS être utilisé dans
 * le middleware Next.js car le runtime web/sandbox valide le header Location
 * avec new URL(location) SANS base, ce qui fait crasher le middleware
 * (TypeError: Invalid URL). Pour le middleware, utiliser
 * absoluteRedirectResponse() (voir relative-redirect.ts).
 *
 * Pour les Route Handlers (fichiers route.ts sous app/api), la Location
 * relative est tolérée car ces routes ne passent pas par le sandbox du
 * middleware. Preferer tout de meme absoluteLocalRedirect() pour robustesse.
 */
export function localRedirect(
  pathname: string,
  searchParams: Record<string, SearchValue> = {},
  status = 307
) {
  const safePathname = safeCallbackPath(pathname, '/');
  const url = new URL(safePathname, 'http://eaumalik.local');

  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return new NextResponse(null, {
    status,
    headers: {
      Location: `${url.pathname}${url.search}${url.hash}`,
    },
  });
}

/**
 * Variante avec Location ABSOLUE, basée sur les headers X-Forwarded-* (et
 * non `request.nextUrl.origin`, qui peut rester figé sur l'adresse interne
 * du container Docker). Garantit qu'on redirige vers un host public joignable
 * depuis le navigateur (ex: https://eaumalik.com), jamais vers
 * http://0.0.0.0:3100 ou http://localhost:3100.
 *
 * À utiliser dans les Route Handlers qui servent de redirects après action
 * (ex: /api/auth/callback après OAuth Google).
 */
export function absoluteLocalRedirect(
  request: NextRequest,
  pathname: string,
  searchParams: Record<string, SearchValue> = {},
  status: 307 | 302 = 307
): NextResponse {
  const safePathname = safeCallbackPath(pathname, '/');
  const origin = browserSafeRequestOrigin(request);
  const target = new URL(safePathname, origin);

  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== null && value !== undefined) {
      target.searchParams.set(key, String(value));
    }
  }

  return new NextResponse(null, {
    status,
    headers: { Location: target.toString() },
  });
}
