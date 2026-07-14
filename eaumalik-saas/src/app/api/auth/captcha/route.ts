/**
 * GET /api/auth/captcha
 *
 * Génère un nouveau CAPTCHA (SVG inline) et pose un cookie signé `eaumalik_captcha`
 * contenant la réponse attendue. Le cookie a une durée de vie de 5 minutes et est
 * à usage unique (consommé lors d'une vérification réussie).
 *
 * Pas d'authentification requise : cet endpoint est public (anti-bot) mais la
 * connaissance de la réponse est gardée côté serveur via la signature HMAC.
 */
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { generateCaptchaSvg, signCaptchaPayload, CAPTCHA_TTL_SECONDS } from '@/lib/captcha';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { svg, answer } = generateCaptchaSvg();
  const token = signCaptchaPayload({ answer, iat: Date.now() });

  // Le cookie n'a PAS besoin d'être httpOnly : la signature HMAC empêche la
  // falsification, et le navigateur doit pouvoir le lire/écraser pour le flux
  // de rechargement (bouton « ↻ » côté UI qui refetche cet endpoint).
  // On garde SameSite=Lax + Path=/ + 5 min.
  cookies().set({
    name: 'eaumalik_captcha',
    value: token,
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: CAPTCHA_TTL_SECONDS,
  });

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      'X-Captcha-Length': String(answer.length),
    },
  });
}