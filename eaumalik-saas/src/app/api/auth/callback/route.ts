import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { SUPABASE_COOKIE_OPTIONS } from '@/lib/supabase/cookies';

function safeCallbackUrl(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : '/client';
}

/** Completes the PKCE exchange after Supabase redirects back from Google. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const callbackUrl = safeCallbackUrl(request.nextUrl.searchParams.get('callbackUrl'));
  const completeUrl = new URL('/login/google-complete', request.url);
  completeUrl.searchParams.set('callbackUrl', callbackUrl);

  if (!code) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', callbackUrl);
    loginUrl.searchParams.set('error', 'oauth_code_missing');
    return NextResponse.redirect(loginUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Configuration Supabase manquante.' }, { status: 500 });
  }

  // Cookies must be written on this redirect response. Mutating a separate
  // cookie store would lose Set-Cookie headers when the response is returned.
  const response = NextResponse.redirect(completeUrl);
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set({ name, value, ...options })
        );
      },
    },
    cookieOptions: SUPABASE_COOKIE_OPTIONS,
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', callbackUrl);
    loginUrl.searchParams.set('error', 'oauth_exchange_failed');
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
