/**
 * Client Supabase côté navigateur.
 * Respecte les RLS policies côté serveur via auth.uid().
 */
import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.trim() === '' || key.trim() === '') {
    throw new Error(
      'Variables Supabase manquantes. Copiez .env.local.example vers .env.local et renseignez NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  return createBrowserClient(url, key);
}

/**
 * Client Supabase DIRECT (sans @supabase/ssr) pour le flux OAuth.
 * Stocke le code_verifier PKCE dans localStorage (et non dans un cookie
 * chunké par @supabase/ssr). Résout le bug "PKCE code verifier not found
 * in storage" car localStorage survit au redirect OAuth sans altération.
 *
 * Ce client n'est PAS destiné aux appels RLS classiques — ses tokens de
 * session sont stockés dans localStorage, pas dans les cookies HTTPOnly.
 * Utiliser UNIQUEMENT pour signInWithOAuth + exchangeCodeForSession.
 */
export function createDirectSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.trim() === '' || key.trim() === '') return null;
  return createClient(url, key, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
      storage: window.localStorage,
    },
  });
}

/** Retourne null si env manquante (utile en dev sans Supabase). */
export function maybeSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.trim() === '' || key.trim() === '') return null;
  return createSupabaseBrowserClient();
}
