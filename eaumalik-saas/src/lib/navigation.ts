const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const UNSPECIFIED_HOSTNAMES = new Set(['0.0.0.0', '[::]', '::']);

// Chemins qui ne doivent JAMAIS servir de destination post-login : routes
// techniques (/api/*), pages d'authentification (/login*), sous-domaines
// staff (/admin/*, /crm/*). Si un callbackUrl pointe dessus, on retombe
// sur le fallback (ex: /client) pour eviter qu'un user finisse sur une
// page qui le deco (ex: /api/auth/logout) ou qui le reboucle sur /login.
function isHostileLandingPath(pathname: string): boolean {
  const p = pathname.toLowerCase();
  if (p.startsWith('/api/')) return true;
  if (p === '/api' || p === '/login' || p.startsWith('/login') ||
      p.startsWith('/admin') || p.startsWith('/crm') ||
      p === '/logout' || p.startsWith('/logout') ||
      p === '/sitemap.xml' || p === '/robots.txt') {
    return true;
  }
  return false;
}

/**
 * Accept only same-origin paths. This value is later passed to router/location,
 * so backslashes and control characters are rejected as well as protocol-relative
 * URLs.
 */
export function safeCallbackPath(value: string | null | undefined, fallback = '/client') {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    CONTROL_CHARACTER.test(value)
  ) {
    return fallback;
  }

  try {
    const base = new URL('http://eaumalik.local');
    const parsed = new URL(value, base);
    if (parsed.origin !== base.origin) return fallback;
    const cleanPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    // Rejeter les chemins hostiles (api, login, logout, admin, crm) qui
    // re-deroutent l'user vers la connexion ou le deconnectent.
    if (isHostileLandingPath(parsed.pathname)) return fallback;
    return cleanPath;
  } catch {
    return fallback;
  }
}

/**
 * Variante stricte pour la page /login/google-complete : on force la
 * destination vers un espace USER reel, jamais vers une route technique
 * ou de re-authentification. Si callbackUrl est invalide ou hostile, on
 * atterrit sur /client (espace prive standard apres login Google).
 */
export function safePostLoginLanding(value: string | null | undefined): string {
  return safeCallbackPath(value, '/client');
}

/**
 * 0.0.0.0/[::] are server bind addresses, not stable browser destinations.
 * Preserve the current protocol and port but use localhost for a local browser.
 */
export function browserSafeOrigin(origin: string) {
  const parsed = new URL(origin);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Origine HTTP invalide.');
  }

  if (UNSPECIFIED_HOSTNAMES.has(parsed.hostname)) {
    parsed.hostname = 'localhost';
  }

  return parsed.origin;
}
