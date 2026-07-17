import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { SUPABASE_COOKIE_OPTIONS } from '@/lib/supabase/cookies';
import { localRedirect } from '@/lib/local-redirect';
import { safeCallbackPath } from '@/lib/navigation';

/** Completes the PKCE exchange after Supabase redirects back from Google. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const callbackUrl = safeCallbackPath(
    request.nextUrl.searchParams.get('callbackUrl'),
    '/client'
  );

  if (!code) {
    return localRedirect('/login', {
      callbackUrl,
      error: 'oauth_code_missing',
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Configuration Supabase manquante.' }, { status: 500 });
  }

  // Cookies must be written on this redirect response. Mutating a separate
  // cookie store would lose Set-Cookie headers when the response is returned.
  const response = localRedirect('/login/google-complete', { callbackUrl });
  const pendingCookies: Parameters<SetAllCookies>[0] = [];
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        pendingCookies.push(...cookiesToSet);
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set({ name, value, ...options })
        );
      },
    },
    cookieOptions: SUPABASE_COOKIE_OPTIONS,
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const errorResponse = localRedirect('/login', {
      callbackUrl,
      error: 'oauth_exchange_failed',
    });
    pendingCookies.forEach(({ name, value, options }) =>
      errorResponse.cookies.set({ name, value, ...options })
    );
    return errorResponse;
  }

  return response;
}
