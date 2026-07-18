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
