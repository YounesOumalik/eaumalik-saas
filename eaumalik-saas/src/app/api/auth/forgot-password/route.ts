/**
 * POST /api/auth/forgot-password
 *
 * Demande de réinitialisation de mot de passe.
 * - Valide le CAPTCHA (anti-bot) avant toute action.
 * - Mode mock : génère un token, le stocke dans data-store/password_resets.json,
 *   et log l'URL de reset en console (dev convenience).
 * - Mode Supabase : appelle supabase.auth.resetPasswordForEmail() (email réel).
 * - Répond TOUJOURS un message générique (ne révèle pas si l'email existe).
 *
 * Body : { email, captcha_answer }
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { z } from 'zod';
import { verifyCaptchaPayload } from '@/lib/captcha';
import { isMockMode, safeErrorResponse } from '@/lib/api-guard';
import { readPasswordResetsRaw, writePasswordResetsRaw } from '@/data/repositories';

export const dynamic = 'force-dynamic';

const ForgotSchema = z.object({
  email: z.string().email('Email invalide.'),
  captcha_answer: z.string().min(1, 'CAPTCHA requis.'),
});

// Message générique renvoyé dans tous les cas (ne révèle pas l'existence du compte).
const GENERIC_OK = {
  ok: true,
  message:
    "Si un compte existe avec cet email, vous recevrez sous peu les instructions de réinitialisation.",
};

export async function POST(req: NextRequest) {
  let parsed: z.infer<typeof ForgotSchema>;
  try {
    const body = await req.json();
    const result = ForgotSchema.safeParse(body);
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

  // --- Validation CAPTCHA (anti-bot) ---
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
    if (isMockMode()) {
      const token = crypto.randomBytes(32).toString('hex');
      const resets = (await readPasswordResetsRaw()) as any[];
      resets.push({
        token,
        email: parsed.email.toLowerCase(),
        expires: Date.now() + 60 * 60 * 1000, // 1 h
        used: false,
        created_at: new Date().toISOString(),
      });
      await writePasswordResetsRaw(resets);

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      // Dev convenience : on log l'URL (en prod on enverrait un vrai email).
      // eslint-disable-next-line no-console
      console.log(
        `[forgot-password] Lien de réinitialisation (mode démo) : ${appUrl}/login/reinitialiser?token=${token}`
      );
    } else {
      const { createSupabaseServerClient } = await import('@/lib/supabase/server');
      const supabase = createSupabaseServerClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.email, {
        redirectTo: `${appUrl}/login/reinitialiser`,
      });
      if (error) {
        // On ne révèle pas l'erreur au client (message générique ci-dessous).
        // eslint-disable-next-line no-console
        console.error('[forgot-password] resetPasswordForEmail error:', error.message);
      }
    }

    return NextResponse.json(GENERIC_OK);
  } catch (err) {
    return safeErrorResponse(err, 'Erreur lors de la demande de réinitialisation.');
  }
}
