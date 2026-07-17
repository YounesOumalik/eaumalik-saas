/**
 * Client Supabase côté navigateur.
 * Respecte les RLS policies côté serveur via auth.uid().
 */
import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.trim() === '' || key.trim() === '') {
    throw new Error(
      'Variables Supabase manquantes. Copiez .env.local.example vers .env.local et renseignez NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  // flowType: 'implicit' au lieu de 'pkce' (défaut).
  // PKCE nécessite de persister le code_verifier dans un cookie navigateur
  // qui doit survivre au redirect OAuth (Google → Supabase → notre app).
  // Avec @supabase/ssr + chunking, ce cookie n'est pas fiablement retrouvé
  // sur la page de retour → "PKCE code verifier not found in storage".
  // Le flow implicite met les tokens directement dans le hash de l'URL,
  // contournant ce problème de persistance de cookie.
  return createBrowserClient(url, key, {
    auth: {
      flowType: 'implicit',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
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
