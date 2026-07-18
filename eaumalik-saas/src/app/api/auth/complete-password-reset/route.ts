import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'node:crypto';
import { verifyCaptchaPayload } from '@/lib/captcha';
import { isMockMode, safeErrorResponse } from '@/lib/api-guard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/auth/password';
import { strongPasswordSchema } from '@/lib/auth/passwordPolicy';
import { readPasswordResetsRaw, readUsersRaw, writePasswordResetsRaw, writeUsersRaw } from '@/data/repositories';

export const dynamic = 'force-dynamic';

const CompleteResetSchema = z.object({
  new_password: strongPasswordSchema,
  confirmation: z.string().min(1, 'Confirmation du mot de passe requise.'),
  captcha_answer: z.string().min(1, 'CAPTCHA requis.'),
  token: z.string().min(32).optional(),
}).superRefine((value, ctx) => {
  if (value.new_password !== value.confirmation) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['confirmation'],
      message: 'Les deux mots de passe ne correspondent pas.',
    });
  }
});

function hashResetToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(req: NextRequest) {
  let parsed: z.infer<typeof CompleteResetSchema>;
  try {
    const result = CompleteResetSchema.safeParse(await req.json());
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message ?? 'Données invalides.' },
        { status: 400 },
      );
    }
    parsed = result.data;
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const captchaToken = cookies().get('eaumalik_captcha')?.value;
  const captchaResult = verifyCaptchaPayload(captchaToken, parsed.captcha_answer);
  cookies().delete('eaumalik_captcha');
  if (!captchaResult.ok) {
    const message = captchaResult.reason === 'expired'
      ? 'CAPTCHA expiré. Rechargez et réessayez.'
      : captchaResult.reason === 'tampered'
        ? 'CAPTCHA invalide.'
        : 'CAPTCHA incorrect.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (isMockMode()) {
      if (!parsed.token) return NextResponse.json({ error: 'Lien de réinitialisation invalide.' }, { status: 400 });
      const tokenHash = hashResetToken(parsed.token);
      const resets = await readPasswordResetsRaw();
      const reset = resets.find((item: any) => item.token_hash === tokenHash && !item.used && Number(item.expires) > Date.now());
      if (!reset) return NextResponse.json({ error: 'Lien expiré ou déjà utilisé.' }, { status: 400 });

      const users = await readUsersRaw();
      const index = users.findIndex((user: any) => user.email?.toLowerCase() === String(reset.email).toLowerCase());
      if (index === -1) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 400 });
      users[index] = { ...users[index], password: hashPassword(parsed.new_password), updated_at: new Date().toISOString() };
      reset.used = true;
      await writeUsersRaw(users);
      await writePasswordResetsRaw(resets);
      return NextResponse.json({ success: true });
    }

    // Le lien Supabase a établi une session de récupération dans le navigateur.
    // Le serveur ne reçoit jamais l'adresse email ni le mot de passe précédent.
    const supabase = createSupabaseServerClient();
    const { data: currentUser, error: userError } = await supabase.auth.getUser();
    if (userError || !currentUser.user) {
      return NextResponse.json({ error: 'Lien de réinitialisation invalide ou expiré.' }, { status: 401 });
    }
    const { error } = await supabase.auth.updateUser({ password: parsed.new_password });
    if (error) return NextResponse.json({ error: 'Mot de passe non mis à jour.' }, { status: 400 });

    // Invalide les sessions existantes après une récupération réussie.
    await supabase.auth.signOut({ scope: 'global' });
    console.info('[security] password_reset_completed', {
      user_id: currentUser.user.id,
      created_at: new Date().toISOString(),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return safeErrorResponse(error, 'Réinitialisation impossible.');
  }
}
