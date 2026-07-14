import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readUsersRaw, writeUsersRaw } from '@/data/repositories';
import { verifyCaptchaPayload } from '@/lib/captcha';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/dev-login
 *
 * Authentification simplifiee pour le mode dev (mocks).
 * Lit/ecrit data-store/users.json directement.
 *
 * Body :
 *   { email, password, isSignUp?, profile?: { full_name, phone, city, address, referred_by } }
 *
 * Reponses :
 *   - 200 { user, created?: true }  si login/signup reussi
 *   - 400 { error }                  si champs invalides
 *   - 401 { error }                  si identifiants incorrects
 *
 * En production cette route n'est pas utilisee (Supabase gere l'auth).
 */
export async function POST(req: NextRequest) {
  // Route dev/mock uniquement — jamais active en production (Supabase gère l'auth).
  const mockMode =
    process.env.NEXT_PUBLIC_USE_MOCKS === 'true' ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!mockMode) {
    return NextResponse.json({ error: 'Route désactivée en production.' }, { status: 404 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, isSignUp = false, captcha_answer, profile } = body as {
      email?: string;
      password?: string;
      isSignUp?: boolean;
      captcha_answer?: string;
      profile?: { full_name?: string; phone?: string; city?: string; address?: string; referred_by?: string };
    };

    // --- Validation CAPTCHA (anti-bot) ---
    const captchaToken = cookies().get('eaumalik_captcha')?.value;
    const captchaRes = verifyCaptchaPayload(captchaToken, captcha_answer);
    // Consomme le cookie (single-use) à CHAQUE tentative, succès ou échec,
    // pour empêcher la réutilisation/replay d'un même challenge résolu.
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

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Mot de passe : minimum 8 caracteres.' }, { status: 400 });
    }

    const users = await readUsersRaw();
    const existing = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

    if (isSignUp) {
      if (existing) {
        return NextResponse.json({ error: 'Un compte existe deja avec cet email.' }, { status: 400 });
      }
      if (!profile?.full_name || profile.full_name.length < 3) {
        return NextResponse.json({ error: 'Nom complet obligatoire.' }, { status: 400 });
      }
      const newUser = {
        id: `u-${Date.now()}`,
        email,
        password, // NOTE : mock-only. En prod : hash cote serveur Supabase.
        full_name: profile.full_name,
        phone: profile.phone || '',
        city: profile.city || '',
        address: profile.address || null,
        role: 'client',
        permissions: {
          can_view_products: true,
          can_edit_products: false,
          can_validate_orders: false,
          can_follow_prospects: false,
          can_view_comptabilite: false,
          can_view_stocks: false,
        },
        referral_code: Math.random().toString(36).slice(2, 8).toUpperCase(),
        referred_by: profile.referred_by || null,
        cashback_balance: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      users.push(newUser);
      await writeUsersRaw(users);
      const res = NextResponse.json({ user: sanitize(newUser), created: true });
      setDevSessionCookie(res, sanitize(newUser));
      return res;
    }

    if (!existing) {
      return NextResponse.json({ error: 'Aucun compte avec cet email.' }, { status: 401 });
    }
    if (existing.password !== password) {
      return NextResponse.json({ error: 'Mot de passe incorrect.' }, { status: 401 });
    }
    const safeUser = sanitize(existing);
    const res = NextResponse.json({ user: safeUser });
    setDevSessionCookie(res, safeUser);
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erreur serveur.' },
      { status: 500 }
    );
  }
}

function sanitize(u: any) {
  const { password: _pw, ...rest } = u;
  return rest;
}

/**
 * Ecrit un cookie httpOnly "eaumalik_dev_session" pour que les Server Actions
 * puissent reconnaitre l'utilisateur via requireUser() en mode mock.
 */
function setDevSessionCookie(res: NextResponse, user: any) {
  res.cookies.set({
    name: 'eaumalik_dev_session',
    value: JSON.stringify(user),
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 jours
  });
}