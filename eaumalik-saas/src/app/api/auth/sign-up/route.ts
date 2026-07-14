/**
 * POST /api/auth/sign-up
 *
 * Proxy d'inscription Supabase. Valide le CAPTCHA côté serveur AVANT tout appel
 * à supabase.auth.signUp(). En mode mock (dev sans Supabase), cette route n'est
 * pas utilisée : l'inscription passe par /api/auth/dev-login (isSignUp=true).
 *
 * Body : { email, password, captcha_answer, profile?: { full_name, phone, city, address, referred_by } }
 * Réponses :
 *   - 200 { user, created: true }
 *   - 400 { error }  (captcha / validation / email déjà utilisé)
 *   - 401 { error }  (erreur Supabase)
 *   - 404 { error }  (mode mock : route inactive)
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { verifyCaptchaPayload } from '@/lib/captcha';
import { isMockMode } from '@/lib/api-guard';
import { safeErrorResponse } from '@/lib/api-guard';
import { PHONE_MA_REGEX } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const SignUpSchema = z.object({
  email: z.string().email('Email invalide.'),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule.')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.'),
  captcha_answer: z.string().min(1, 'CAPTCHA requis.'),
  profile: z
    .object({
      full_name: z.string().min(3, 'Nom complet obligatoire (min. 3 caractères).'),
      phone: z.string().regex(PHONE_MA_REGEX, 'Numéro de téléphone invalide (ex: 0XXXXXXXXX).'),
      city: z.string().min(1, 'La ville est obligatoire.'),
      address: z.string().nullable().optional(),
      referred_by: z.string().nullable().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  // Route inactive en mode mock : l'inscription y passe par /api/auth/dev-login.
  if (isMockMode()) {
    return NextResponse.json({ error: 'Route inactive en mode démo.' }, { status: 404 });
  }

  let parsed: z.infer<typeof SignUpSchema>;
  try {
    const body = await req.json();
    const result = SignUpSchema.safeParse(body);
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
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.email,
      password: parsed.password,
      options: {
        data: {
          full_name: parsed.profile?.full_name ?? null,
          phone: parsed.profile?.phone ?? null,
          city: parsed.profile?.city ?? null,
          address: parsed.profile?.address ?? null,
          referred_by: parsed.profile?.referred_by ?? null,
        },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message || 'Inscription impossible.' }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: data.user?.id,
        email: data.user?.email,
        role: (data.user?.user_metadata?.role as string) ?? 'client',
      },
      created: true,
    });
  } catch (err) {
    return safeErrorResponse(err, 'Erreur lors de la création du compte.');
  }
}
