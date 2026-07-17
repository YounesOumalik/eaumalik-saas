/**
 * Proxy serveur pour l'échange PKCE.
 *
 * Le POST /auth/v1/token?grant_type=pkce est bloqué par CORS côté navigateur
 * (la réponse ne contient pas Access-Control-Allow-Origin). Cette route fait
 * l'échange côté serveur (pas de CORS), puis pose les cookies de session.
 *
 * Flow :
 *   1. Client lit `code` depuis l'URL et `code_verifier` depuis localStorage
 *   2. Client POST /api/auth/exchange-code { code, codeVerifier }
 *   3. Cette route appelle POST /auth/v1/token?grant_type=pkce côté serveur
 *   4. Reçoit les tokens → utilise @supabase/ssr pour poser les cookies
 *   5. Retourne { ok: true } au client
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { code, codeVerifier }: { code?: string; codeVerifier?: string } =
      await request.json();

    if (!code || !codeVerifier) {
      return NextResponse.json(
        { ok: false, error: 'Code ou code_verifier manquant.' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { ok: false, error: 'Configuration serveur manquante.' },
        { status: 500 }
      );
    }

    // Appel direct au endpoint token de Supabase (côté serveur → pas de CORS).
    const tokenUrl = `${supabaseUrl}/auth/v1/token?grant_type=pkce`;
    const tokenResp = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
      },
      body: JSON.stringify({
        auth_code: code,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResp.ok) {
      const errBody = await tokenResp.json().catch(() => ({}));
      return NextResponse.json(
        {
          ok: false,
          error:
            (errBody as any)?.msg ||
            (errBody as any)?.error_description ||
            `Erreur Supabase HTTP ${tokenResp.status}`,
        },
        { status: 502 }
      );
    }

    const tokenData = await tokenResp.json();

    if (!tokenData.access_token || !tokenData.refresh_token) {
      return NextResponse.json(
        { ok: false, error: 'Tokens manquants dans la réponse Supabase.' },
        { status: 502 }
      );
    }

    // Poser les cookies de session via @supabase/ssr.
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]
        ) {
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

    const { error: sessionErr } = await supabase.auth.setSession({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
    });

    if (sessionErr) {
      return NextResponse.json(
        { ok: false, error: sessionErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Erreur inattendue.',
      },
      { status: 500 }
    );
  }
}
