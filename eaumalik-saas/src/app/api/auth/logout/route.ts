import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const AUTH_COOKIE_PREFIXES = [
  'eaumalik-sb-auth',
  'sb-',
  'supabase-auth-token',
] as const;

function isAuthCookie(name: string): boolean {
  return (
    name === 'eaumalik_dev_session' ||
    AUTH_COOKIE_PREFIXES.some(prefix => name.startsWith(prefix))
  );
}

/**
 * Déconnexion navigateur fiable :
 * - efface les cookies Supabase, y compris leurs éventuels fragments ;
 * - efface le cookie httpOnly du mode local ;
 * - renvoie directement vers /login avec une Location relative.
 *
 * La Location relative est volontaire : elle ne peut pas exposer l'adresse
 * interne du conteneur derrière le reverse proxy.
 */
export async function GET(request: NextRequest) {
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: '/login',
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });

  const cookieNames = new Set(
    request.cookies
      .getAll()
      .map(cookie => cookie.name)
      .filter(isAuthCookie)
  );

  // Ces noms connus doivent être invalidés même si le navigateur ne les a pas
  // inclus dans la requête (par exemple après un changement de configuration).
  cookieNames.add('eaumalik_dev_session');
  cookieNames.add('eaumalik-sb-auth');

  for (const name of cookieNames) {
    response.cookies.set({
      name,
      value: '',
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      expires: new Date(0),
      maxAge: 0,
    });
  }

  return response;
}
