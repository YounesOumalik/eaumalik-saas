import { NextResponse } from 'next/server';
import { safeCallbackPath } from './navigation';

type SearchValue = string | number | boolean | null | undefined;

/**
 * Return a relative Location header so Next.js never replaces the public host
 * with its internal bind address (for example 0.0.0.0 inside Docker).
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
