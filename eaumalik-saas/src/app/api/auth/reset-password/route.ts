/**
 * POST /api/auth/reset-password
 *
 * Application d'un nouveau mot de passe (mode mock uniquement).
 * - Valide le CAPTCHA (anti-bot).
 * - Vérifie le token (existence, non expiré, non déjà utilisé).
 * - Met à jour le mot de passe en clair dans data-store/users.json (mode mock).
 * - Marque le token comme utilisé.
 *
 * En mode Supabase, le reset se fait côté client via supabase.auth.updateUser()
 * (le token de recovery est dans le hash URL) — cette route n'est donc pas
 * sollicitée en prod.
 *
 * Body : { token, password, password_confirm, captcha_answer }
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { verifyCaptchaPayload } from '@/lib/captcha';
import { isMockMode, safeErrorResponse } from '@/lib/api-guard';
import { readPasswordResetsRaw, writePasswordResetsRaw, readUsersRaw, writeUsersRaw } from '@/data/repositories';

export const dynamic = 'force-dynamic';

const ResetSchema = z
  .object({
    token: z.string().min(1, 'Token manquant.'),
    password: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
      .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule.')
      .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.'),
    password_confirm: z.string().min(1, 'Confirmation requise.'),
    captcha_answer: z.string().min(1, 'CAPTCHA requis.'),
  })
  .refine((d) => d.password === d.password_confirm, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['password_confirm'],
  });

export async function POST(req: NextRequest) {
  if (!isMockMode()) {
    return NextResponse.json(
      { error: 'Route inactive en production (utilisez le reset Supabase).' },
      { status: 404 }
    );
  }

  let parsed: z.infer<typeof ResetSchema>;
  try {
    const body = await req.json();
    const result = ResetSchema.safeParse(body);
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
    const resets = (await readPasswordResetsRaw()) as any[];
    const idx = resets.findIndex((r: any) => r.token === parsed.token);
    if (idx === -1) {
      return NextResponse.json({ error: 'Lien de réinitialisation invalide.' }, { status: 400 });
    }
    const reset = resets[idx];
    if (reset.used) {
      return NextResponse.json({ error: 'Ce lien a déjà été utilisé.' }, { status: 400 });
    }
    if (Date.now() > reset.expires) {
      return NextResponse.json({ error: 'Ce lien a expiré. Demandez-en un nouveau.' }, { status: 400 });
    }

    const users = await readUsersRaw();
    const userIdx = users.findIndex(
      (u: any) => u.email?.toLowerCase() === reset.email.toLowerCase()
    );
    if (userIdx === -1) {
      // Ne révèle pas l'absence de compte : on consomme quand même le token.
      resets[idx].used = true;
      await writePasswordResetsRaw(resets);
      return NextResponse.json({ error: 'Lien de réinitialisation invalide.' }, { status: 400 });
    }

    users[userIdx].password = parsed.password; // mock-only (claire en dev)
    users[userIdx].updated_at = new Date().toISOString();
    await writeUsersRaw(users);

    resets[idx].used = true;
    await writePasswordResetsRaw(resets);

    return NextResponse.json({ ok: true, message: 'Mot de passe mis à jour avec succès.' });
  } catch (err) {
    return safeErrorResponse(err, 'Erreur lors de la réinitialisation.');
  }
}
