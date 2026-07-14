import { NextRequest, NextResponse } from 'next/server';
import { getDevUserFromCookie, isDevMockMode, clearDevSessionCookie } from '@/lib/auth/devSession';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/dev-session
 *
 * Renvoie la session dev (mode mock) lue depuis le cookie httpOnly
 * `eaumalik_dev_session`. Permet au client (Navbar, Providers) de récupérer
 * l'utilisateur connecté de façon fiable, partagée entre onglets et après
 * un refresh — contrairement à sessionStorage.
 *
 * Réponses :
 *   - 200 { user }                 si session dev présente
 *   - 401 { error }                si non authentifié
 *   - 404 { error }                si mode prod (Supabase configuré)
 *
 * DELETE /api/auth/dev-session
 *
 * Efface le cookie de session dev (déconnexion mode mock).
 */
export async function GET(req: NextRequest) {
  if (!isDevMockMode()) {
    return NextResponse.json({ error: 'Route désactivée en production.' }, { status: 404 });
  }
  const user = await getDevUserFromCookie();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }
  return NextResponse.json({ user });
}

export async function DELETE(req: NextRequest) {
  if (!isDevMockMode()) {
    return NextResponse.json({ error: 'Route désactivée en production.' }, { status: 404 });
  }
  const res = NextResponse.json({ success: true });
  clearDevSessionCookie(res);
  return res;
}
