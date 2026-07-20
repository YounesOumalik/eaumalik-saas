import { headers } from 'next/headers';

/**
 * Retourne l'origine HTTP courante (proto://host) a partir des headers
 * forwardes par le reverse-proxy (Caddy, Cloudflare, etc.).
 *
 * Utilise X-Forwarded-Proto et X-Forwarded-Host en priorite (standards
 * de-facto des proxies), avec fallback sur le header Host natif et le
 * proto https par defaut.
 *
 * Usage : remplacer les references a NEXT_PUBLIC_APP_URL (fixee au build)
 * dans les Server Actions qui construisent des URLs de redirection
 * (resetPasswordForEmail, signUp.emailRedirectTo...).
 *
 * Exemples :
 *   getAppOrigin() // "https://eaumalik.com"
 *   getAppOrigin() // "https://admin.eaumalik.com"
 */
export function getAppOrigin(): string {
  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'eaumalik.com';
  return `${proto}://${host}`;
}
