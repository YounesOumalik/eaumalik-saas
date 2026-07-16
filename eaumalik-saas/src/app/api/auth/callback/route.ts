/**
 * Callback OAuth (PKCE) — point de retour APRÈS Google/Supabase.
 *
 * Flow OAuth officiel avec @supabase/ssr PKCE :
 *   1. Client appelle `supabase.auth.signInWithOAuth({ provider: 'google',
 *      options: { redirectTo: '/api/auth/callback?callbackUrl=/panier' } })`.
 *   2. Supabase redirige vers Google (consent screen).
 *   3. Google redirige vers `https://<supabase>/auth/v1/callback?code=...`.
 *   4. Supabase renvoie vers `redirectTo` (notre route ici) AVEC le `?code=...`.
 *   5. Cette route sert une page HTML qui :
 *      - charge le client Supabase navigateur
 *      - appelle `supabase.auth.exchangeCodeForSession(code)` (échange PKCE)
 *      - redirige vers `/login/google-complete?callbackUrl=...` SANS le `code`
 *
 * Pourquoi cette route est INDISPENSABLE :
 *   - Sans elle, l'URL de retour garde `?code=...` et le client Supabase doit
 *     l'extraire via `detectSessionInUrl: true`. Si une navigation (router.push,
 *     refresh, etc.) se produit AVANT la fin de l'échange, le code est perdu
 *     → pas de session créée → boucle vers /login (l'utilisateur "revient à la
 *     même page" indéfiniment).
 *   - Avec cette route serveur, l'échange PKCE se fait dans une page DÉDIÉE,
 *     avant toute navigation vers google-complete, et les cookies de session
 *     sont posés de manière fiable (HTTPOnly côté Supabase).
 *
 * Pourquoi on n'utilise PAS une route serveur qui appelle /auth/v1/token
 * directement : @supabase/ssr PKCE stocke le `code_verifier` dans le
 * localStorage / cookie DU NAVIGATEUR (pas du serveur), donc l'échange doit
 * se faire côté client pour récupérer ce verifier.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const callbackUrl = url.searchParams.get('callbackUrl') || '/client';
  const errorParam = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Open-redirect guard : on n'accepte que des chemins relatifs internes.
  const safeCallbackUrl = callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
    ? callbackUrl
    : '/client';

  // OAuth a renvoyé une erreur → on remonte à google-complete pour l'afficher.
  if (errorParam) {
    const completeUrl = new URL('/login/google-complete', url.origin);
    completeUrl.searchParams.set('callbackUrl', safeCallbackUrl);
    completeUrl.searchParams.set('error', errorDescription || errorParam);
    return NextResponse.redirect(completeUrl);
  }

  if (!code) {
    const completeUrl = new URL('/login/google-complete', url.origin);
    completeUrl.searchParams.set('callbackUrl', safeCallbackUrl);
    completeUrl.searchParams.set('error', 'Code OAuth manquant dans le callback.');
    return NextResponse.redirect(completeUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Page HTML qui fait l'échange PKCE côté navigateur puis redirige.
  // On injecte les variables d'env via meta tags pour que le script puisse
  // créer le client Supabase sans dépendre du bundle Next.js.
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-supabase-url" content="${escapeHtml(supabaseUrl)}" />
  <meta name="x-supabase-key" content="${escapeHtml(supabaseKey)}" />
  <title>Connexion en cours — EAUMALIK</title>
  <style>
    body {
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      background: #0a0f1e;
      color: #f0f9ff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
    }
    .spinner {
      width: 44px; height: 44px;
      border: 3px solid #1e3a5f;
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 18px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 18px; font-weight: 600; margin: 0 0 6px; }
    p { font-size: 13px; opacity: 0.75; margin: 0; max-width: 480px; text-align: center; }
    .err { color: #fca5a5; margin-top: 12px; font-size: 12px; }
    a { color: #38bdf8; margin-top: 16px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="spinner" id="sp"></div>
  <h1 id="t">Connexion en cours…</h1>
  <p id="s">Nous finalisons votre authentification avec Google.</p>
  <p id="err" class="err" hidden></p>
  <a id="lnk" href="#" hidden>Retour à la page de connexion</a>

  <script type="module">
    const code = ${JSON.stringify(code)};
    const callbackUrl = ${JSON.stringify(safeCallbackUrl)};

    function fail(msg) {
      document.getElementById('sp').style.display = 'none';
      document.getElementById('t').textContent = 'Erreur de connexion';
      const err = document.getElementById('err');
      err.textContent = msg;
      err.hidden = false;
      const lnk = document.getElementById('lnk');
      lnk.href = '/login?callbackUrl=' + encodeURIComponent(callbackUrl);
      lnk.hidden = false;
    }

    try {
      const urlMeta = document.querySelector('meta[name="x-supabase-url"]');
      const keyMeta = document.querySelector('meta[name="x-supabase-key"]');
      const supabaseUrl = urlMeta && urlMeta.content;
      const supabaseKey = keyMeta && keyMeta.content;

      if (!supabaseUrl || !supabaseKey) {
        fail('Configuration Supabase manquante côté client.');
        return;
      }

      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.4');
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: false,
          persistSession: true,
          autoRefreshToken: true,
        },
      });

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        fail('Échec de l\\u2019échange de session : ' + (error.message || error));
        return;
      }

      // Session posée avec succès → rediriger vers google-complete
      // (qui affichera le formulaire si profil incomplet, ou redirigera
      // directement vers callbackUrl si profil déjà complet).
      const target = '/login/google-complete?callbackUrl=' + encodeURIComponent(callbackUrl);
      window.location.replace(target);
    } catch (err) {
      fail(err && err.message ? err.message : String(err));
    }
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}