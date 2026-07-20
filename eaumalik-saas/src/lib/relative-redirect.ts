import { NextResponse, type NextRequest } from 'next/server';
import { safeCallbackPath } from './navigation';
import { browserSafeRequestOrigin } from './request-origin';

type SearchValue = string | number | boolean | null | undefined;

/** Build a browser-relative Location without using request.url or an internal host. */
export function relativeRedirectLocation(
  pathname: string,
  searchParams: Record<string, SearchValue> = {}
): string {
  const safePathname = safeCallbackPath(pathname, '/');
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== null && value !== undefined) params.set(key, String(value));
  }

  const query = params.toString();
  return query ? `${safePathname}?${query}` : safePathname;
}

/**
 * Convertit une destination locale validée en URL absolue pour les runtimes
 * (notamment Edge) qui refusent les en-têtes Location relatifs.
 */
export function absoluteRedirectUrl(
  requestUrl: string,
  pathname: string,
  searchParams: Record<string, SearchValue> = {}
): URL {
  return new URL(relativeRedirectLocation(pathname, searchParams), requestUrl);
}

/**
 * Build a NextResponse with an ABSOLUTE Location header.
 *
 * Pourquoi absolue ? Le runtime Next.js (web/sandbox) appelle `new URL(location)`
 * SANS base pour valider les en-têtes Location des réponses 3xx. Une Location
 * relative comme `/login?callbackUrl=%2F` fait donc crasher le middleware avec
 * `TypeError: Invalid URL` (ERR_INVALID_URL) — ce qui casse TOUTES les routes
 * protégées (/admin, /crm, /client) et la redirection post-Google.
 *
 * On déduit l'origine publique à partir des headers X-Forwarded-* (et non de
 * `request.nextUrl.origin`, qui peut rester figé sur l'adresse interne du
 * container Docker, ex: http://0.0.0.0:3100). Résultat : on redirige TOUJOURS
 * vers un host public joignable depuis le navigateur (ex: https://eaumalik.com),
 * jamais vers une addresse non routable.
 */
export function absoluteRedirectResponse(
  request: NextRequest,
  pathname: string,
  searchParams: Record<string, SearchValue> = {},
  status: 307 | 302 = 307
): NextResponse {
  const origin = browserSafeRequestOrigin(request);
  const target = absoluteRedirectUrl(origin, pathname, searchParams);
  return new NextResponse(null, {
    status,
    headers: { Location: target.toString() },
  });
}
