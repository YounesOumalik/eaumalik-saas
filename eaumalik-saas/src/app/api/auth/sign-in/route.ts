/**
 * POST /api/auth/sign-in
 *
 * Proxy de connexion Supabase. Valide le CAPTCHA côté serveur AVANT tout appel
 * à supabase.auth.signInWithPassword(). En mode mock (dev sans Supabase), cette
 * route n'est pas utilisée : la connexion passe par /api/auth/dev-login.
 *
 * Body : { email, password, captcha_answer }
 * Réponses :
 *   - 200 { user: { id, email, role } }
 *   - 400 { error }  (captcha / validation)
 *   - 401 { error }  (identifiants incorrects)
 *   - 404 { error }  (mode mock : route inactive)
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { verifyCaptchaPayload } from '@/lib/captcha';
import { isMockMode, safeErrorResponse } from '@/lib/api-guard';

export const dynamic = 'force-dynamic';

const SignInSchema = z.object({
  email: z.string().email('Email invalide.'),
  password: z.string().min(1, 'Mot de passe requis.'),
  captcha_answer: z.string().min(1, 'CAPTCHA requis.'),
});

export async function POST(req: NextRequest) {
  // Route inactive en mode mock : la connexion y passe par /api/auth/dev-login.
  // ⚠️ DÉSACTIVÉ TEMPORAIREMENT pour debug : la vérification estMockMode()
  // renvoie true à tort même quand NEXT_PUBLIC_SUPABASE_URL est défini.
  // if (isMockMode()) {
  //   return NextResponse.json({ error: 'Route inactive en mode démo.' }, { status: 404 });
  // }

  let parsed: z.infer<typeof SignInSchema>;
  try {
    const body = await req.json();
    const result = SignInSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message ?? 'Données invalides.' },
        { status: 400 }
      );
    }
    parsed = result.data;
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  // --- Validation CAPTCHA (anti-bot / anti brute-force) ---
  const captchaToken = cookies().get('eaumalik_captcha')?.value;
  const captchaRes = verifyCaptchaPayload(captchaToken, parsed.captcha_answer);
  // Consomme le cookie (single-use) à chaque tentative.
  cookies().delete('eaumalik_captcha');
  if (!captchaRes.ok) {
    const msg =
      captchaRes.reason === 'expired'
        ? 'CAPTCHA expiré. Rechargez et réessayez.'
        : captchaRes.reason === 'tampered'
          ? 'CAPTCHA invalide.'
          : 'CAPTCHA incorrect.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });

    if (error) {
      return NextResponse.json({ error: 'Email ou mot de passe incorrect.' }, { status: 401 });
    }

    const role = (data.user?.user_metadata?.role as string) ?? 'client';
    return NextResponse.json({
      user: {
        id: data.user?.id,
        email: data.user?.email,
        role,
      },
    });
  } catch (err) {
    return safeErrorResponse(err, 'Erreur de connexion.');
  }
}
