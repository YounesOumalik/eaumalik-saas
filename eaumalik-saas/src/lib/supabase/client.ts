/**
 * Client Supabase côté navigateur.
 * Respecte les RLS policies côté serveur via auth.uid().
 */
import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_COOKIE_OPTIONS } from './cookies';

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.trim() === '' || key.trim() === '') {
    throw new Error(
      'Variables Supabase manquantes. Copiez .env.local.example vers .env.local et renseignez NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  return createBrowserClient(url, key, {
    cookieOptions: SUPABASE_COOKIE_OPTIONS,
  });
}

/** Retourne null si env manquante (utile en dev sans Supabase). */
export function maybeSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.trim() === '' || key.trim() === '') return null;
  return createSupabaseBrowserClient();
}
