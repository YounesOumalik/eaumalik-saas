import type { NextRequest } from 'next/server';

const UNSPECIFIED_HOSTS = new Set(['0.0.0.0', '[::]', '::', '127.0.0.1', 'localhost']);

function isProductionPublicHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (UNSPECIFIED_HOSTS.has(lower)) return false;
  return (
    lower === 'eaumalik.com' ||
    lower.endsWith('.eaumalik.com') ||
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local')
  );
}

/**
 * Retourne l'origine publique de la requete ("https://eaumalik.com") a partir
 * des headers X-Forwarded-* lorsque le serveur est derriere un reverse-proxy
 * (Caddy, Cloudflare, Nginx...). Toujours absolue pour eviter les crashs
 * `new URL(location)` dans le sandbox Next.js.
 *
 * Reconstruit l'origine meme si `request.nextUrl.origin` pointe sur l'adresse
 * de bind interne du container (ex: "http://0.0.0.0:3100"), ce qui arrive
 * quand le serveur n'a pas ete informe de l'origine reelle du visiteur.
 *
 * Usage : base des helpers `absoluteRedirectResponse` (middleware) et
 * `absoluteLocalRedirect` (route handlers).
 */
export function getRequestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';

  const rawHost = (forwardedHost ?? host ?? '').split(',')[0]?.trim() ?? '';
  const hostOnly = rawHost.split(':')[0];
  const port = rawHost.includes(':') ? `:${rawHost.split(':').pop()}` : '';

  if (!hostOnly) {
    // Fallback sur l'origine Next.js, mais filtre les addresses "unspecified".
    try {
      const next = new URL(request.nextUrl.toString());
      if (!UNSPECIFIED_HOSTS.has(next.hostname)) {
        return `${next.protocol}//${next.host}`;
      }
    } catch {
      // ignore
    }
    return 'https://eaumalik.com';
  }

  // Host public exploitable -> on garde le port uniquement s'il est non-standard.
  const includePort = !!port && port !== ':80' && port !== ':443';
  return `${proto}://${hostOnly}${includePort ? port : ''}`;
}

/**
 * Variante tolerante : retourne l'origine "sure" pour un navigateur, en
 * eliminant toute addresse non routable (0.0.0.0, [::], 127.0.0.1, localhost)
 * SAUF si elle correspond a un contexte explicitement local.
 */
export function browserSafeRequestOrigin(request: NextRequest): string {
  const origin = getRequestOrigin(request);
  try {
    const parsed = new URL(origin);
    if (
      !isProductionPublicHost(parsed.hostname) &&
      UNSPECIFIED_HOSTS.has(parsed.hostname)
    ) {
      return 'https://eaumalik.com';
    }
    return origin;
  } catch {
    return 'https://eaumalik.com';
  }
}
