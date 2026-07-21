import 'server-only';
import crypto from 'node:crypto';
import { isMockMode } from '@/lib/api-guard';

/**
 * Helpers de session pour le mode dev/mock (sans Supabase).
 * La session est portée par un cookie httpOnly `eaumalik_dev_session`
 * posé par /api/auth/dev-login, protégé par signature HMAC.
 */

export interface DevUser {
  id: string;
  email: string;
  /** Rôle réel (admin, client, technician, stock_manager, sales, admin_assistant…). */
  role: string;
  full_name: string | null;
  permissions?: Record<string, boolean> | null;
}

function getSecret(): string {
  const fromEnv = process.env.CAPTCHA_SECRET?.trim();
  if (fromEnv) return fromEnv;
  // Fallback dev stable basé sur le CWD
  return crypto.createHash('sha256').update(`eaumalik-dev-session-secret:${process.cwd()}`).digest('hex');
}

export function signPayload(payload: Record<string, any>): string {
  const data = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', getSecret()).update(data).digest('hex');
  return `${data}.${signature}`;
}

export function verifyPayload(value: string): Record<string, any> | null {
  try {
    // FIX : le séparateur '.' peut apparaître DANS le JSON (ex: emails comme
    // 'user@gmail.com', timestamps ISO '2026-07-11T15:52:54.421Z'). split('.')
    // éclate alors le tableau en >2 morceaux et la vérification échoue.
    // On utilise lastIndexOf('.') pour ne découper qu'au DERNIER point,
    // qui sépare toujours la signature HMAC du payload.
    const lastDot = value.lastIndexOf('.');
    if (lastDot < 0) return null;
    const data = value.slice(0, lastDot);
    const signature = value.slice(lastDot + 1);
    if (!data || !signature) return null;
    const expectedSignature = crypto.createHmac('sha256', getSecret()).update(data).digest('hex');
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null;
    }
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Lit la session dev (mode mock) depuis le cookie httpOnly posé par
 * /api/auth/dev-login, ou retourne null si pas en mode dev.
 */
export async function getDevUserFromCookie(): Promise<DevUser | null> {
  if (process.env.NEXT_PUBLIC_USE_MOCKS !== 'true') return null;
  const hasEnv =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (hasEnv) return null; // mode Supabase réel : on ne court-circuite pas

  try {
    const { cookies } = await import('next/headers');
    const store = cookies();
    const raw = store.get('eaumalik_dev_session')?.value;
    if (!raw) return null;
    const u = verifyPayload(raw);
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      role: u.role ?? 'client',
      full_name: u.full_name ?? null,
      permissions: u.permissions ?? null,
    };
  } catch {
    return null;
  }
}

/** Vrai si on est en mode mock/dev (pas de Supabase configuré). */
export function isDevMockMode(): boolean {
  return isMockMode();
}

/** Ecrit le cookie de session dev signé. */
export function setDevSessionCookie(res: {
  cookies: {
    set: (opts: {
      name: string;
      value: string;
      httpOnly: boolean;
      sameSite: 'lax' | 'strict' | 'none';
      path: string;
      maxAge: number;
    }) => void;
  };
}, user: Record<string, any>) {
  res.cookies.set({
    name: 'eaumalik_dev_session',
    value: signPayload(user),
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 jours
  });
}

/** Efface le cookie de session dev (déconnexion mode mock). */
export function clearDevSessionCookie(res: {
  cookies: {
    set: (opts: {
      name: string;
      value: string;
      httpOnly: boolean;
      sameSite: 'lax' | 'strict' | 'none';
      path: string;
      maxAge: number;
    }) => void;
  };
}) {
  res.cookies.set({
    name: 'eaumalik_dev_session',
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
