const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const UNSPECIFIED_HOSTNAMES = new Set(['0.0.0.0', '[::]', '::']);

// Chemins qui ne doivent JAMAIS servir de destination POST-LOGIN : routes
// techniques (/api/*), pages d'authentification (/login*), sous-domaines
// staff (/admin/*, /crm/*). Si un callbackUrl pointe dessus, on retombe
// sur le fallback (ex: /client) pour eviter qu'un user finisse sur une
// page qui le deco (ex: /api/auth/logout) ou qui le reboucle sur /login.
//
// ⚠️ Ce filtre ne s'applique QUE aux destinations post-login (via
// `safePostLoginLanding`). Il NE DOIT PAS être utilisé pour valider une
// destination de REDIRECT vers une page d'auth (ex: /login, /login/google-complete),
// sinon on crée une boucle : le middleware redirige vers /login → /login est
// rejeté comme "hostile" → fallback / → l'utilisateur n'atteint jamais /login.
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
 * Valide qu'un chemin est same-origin et peut servir de destination de
 * navigation/redirect SANS filtrer les routes d'authentification.
 *
 * Accepte uniquement :
 *  - des chemins absolus commençant par `/` (pas de `//`, pas de protocole),
 *  - sans backslash ni caractère de contrôle,
 *  - ne résolvant pas vers une autre origin (anti open-redirect).
 *
 * ⚠️ NE filtre PAS /login, /admin, /crm, /api : ces chemins sont des
 * destinations de redirect légitimes pour le middleware (protection des
 * routes privées → /login) et le callback OAuth (→ /login, /login/google-complete).
 * Pour filtrer les destinations POST-LOGIN uniquement, utiliser
 * `safePostLoginLanding()`.
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
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Variante stricte pour les destinations POST-LOGIN (page
 * /login/google-complete, callback OAuth) : on force l'atterrissage vers un
 * espace USER reel, jamais vers une route technique ou de re-authentification.
 *
 * Si callbackUrl est invalide, cross-origin, ou hostile (api, login, logout,
 * admin, crm), on atterrit sur /client (espace prive standard apres login).
 *
 * ⚠️ Ne PAS utiliser pour valider une destination de redirect VERS /login.
 */
export function safePostLoginLanding(value: string | null | undefined): string {
  const safe = safeCallbackPath(value, '/client');
  try {
    const parsed = new URL(safe, 'http://eaumalik.local');
    // Rejeter les chemins hostiles (api, login, logout, admin, crm) qui
    // re-deroutent l'user vers la connexion ou le deconnectent.
    if (isHostileLandingPath(parsed.pathname)) return '/client';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/client';
  }
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
