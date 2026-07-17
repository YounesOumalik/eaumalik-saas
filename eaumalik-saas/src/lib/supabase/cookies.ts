import type { CookieOptionsWithName } from '@supabase/ssr';

/**
 * Shared by every Supabase client. Keeping this name stable is essential for
 * PKCE: the browser writes the verifier before leaving for Google and the
 * callback route must read that exact cookie on the way back.
 *
 * `@supabase/ssr` may append chunk suffixes when a value is large. That is
 * expected; its getAll/setAll adapters reassemble and clean up those chunks.
 */
export const SUPABASE_COOKIE_OPTIONS: CookieOptionsWithName = {
  name: 'eaumalik-sb-auth',
  path: '/',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7,
};
