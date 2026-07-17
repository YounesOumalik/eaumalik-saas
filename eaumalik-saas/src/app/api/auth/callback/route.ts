/**
 * Callback OAuth serveur — échange le code PKCE côté serveur.
 *
 * Le client navigateur @supabase/ssr stocke le code_verifier PKCE dans un
 * cookie (document.cookie, path=/, sameSite=lax). Ce cookie survit au redirect
 * OAuth (Google → Supabase → notre serveur). Cette route SERVEUR lit ce cookie,
 * échange le code, pose les cookies de session, puis redirige vers
 * /login/google-complete SANS le ?code= dans l'URL.
 *
 * Pourquoi c'est nécessaire : la page /login/google-complete est un composant
 * React. Son useEffect appelle getUser() qui déclenche l'échange PKCE. Mais si
 * le composant se démonte/remonte ou si getUser() timeout, le code est perdu
 * → l'utilisateur revient sur /login en boucle.
 *
 * Avec cette route serveur, l'échange est fait AVANT que React ne monte.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const callbackUrl = url.searchParams.get('callbackUrl') || '/client';
  const errorParam = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  const safeCallbackUrl = callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
    ? callbackUrl
    : '/client';

  const completeUrl = new URL('/login/google-complete', request.url);
  completeUrl.searchParams.set('callbackUrl', safeCallbackUrl);

  if (errorParam) {
    completeUrl.searchParams.set('error', errorDescription || errorParam);
    return NextResponse.redirect(completeUrl);
  }

  if (!code) {
    completeUrl.searchParams.set('error', 'Code OAuth manquant');
    return NextResponse.redirect(completeUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    completeUrl.searchParams.set('error', 'Configuration serveur manquante');
    return NextResponse.redirect(completeUrl);
  }

  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // non-bloquant
          }
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[auth/callback] exchangeCodeForSession failed:', error.message);
      completeUrl.searchParams.set('error', error.message);
      return NextResponse.redirect(completeUrl);
    }

    return NextResponse.redirect(completeUrl);
  } catch (err) {
    console.error('[auth/callback] unexpected:', err);
    completeUrl.searchParams.set(
      'error',
      err instanceof Error ? err.message : 'Erreur inattendue'
    );
    return NextResponse.redirect(completeUrl);
  }
}
