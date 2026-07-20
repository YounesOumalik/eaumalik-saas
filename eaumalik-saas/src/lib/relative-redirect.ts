import { NextResponse, type NextRequest } from 'next/server';
import { safeCallbackPath } from './navigation';

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
 * On utilise `request.nextUrl.origin` comme base : derrière un reverse-proxy
 * correctement configuré (Caddy envoie X-Forwarded-Proto + Host), cet origin
 * est l'origin public (ex: https://eaumalik.com), pas le bind address interne.
 */
export function absoluteRedirectResponse(
  request: NextRequest,
  pathname: string,
  searchParams: Record<string, SearchValue> = {},
  status: 307 | 302 = 307
): NextResponse {
  const target = absoluteRedirectUrl(request.nextUrl.origin, pathname, searchParams);
  return new NextResponse(null, {
    status,
    headers: { Location: target.toString() },
  });
}
