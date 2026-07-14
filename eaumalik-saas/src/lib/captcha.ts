/**
 * CAPTCHA maison — génération d'un SVG déformé + signature/vérification HMAC.
 *
 * - Single-use : le cookie est consommé à chaque vérification réussie.
 * - Expiration : 5 minutes (TTL appliqué côté cookie + vérifié à la validation).
 * - Pas de dépendance externe : le SVG est généré inline (Node + string concat).
 * - La réponse attendue est stockée en clair dans un payload JSON signé HMAC-SHA256
 *   avec `CAPTCHA_SECRET` (fallback dev déterministe si non défini).
 *
 * Limites connues :
 * - Ce CAPTCHA est une barrière « soft » : il bloque les bots naïfs et la majorité
 *   des scripts d'inscription abusive. Pour une protection forte, combiner avec
 *   un rate-limit IP (hors scope MVP).
 * - Pas d'audio-captcha / accessibilité avancée. Conforme à un usage standard.
 */
import crypto from 'node:crypto';

/** Longueur du challenge (nombre de caractères affichés). */
export const CAPTCHA_LENGTH = 5;
/** Durée de validité d'un challenge, en secondes. */
export const CAPTCHA_TTL_SECONDS = 5 * 60;

/**
 * Alphabet « sûr » : on retire les caractères visuellement ambigus pour limiter
 * la frustration utilisateur (0/O, 1/l/I) tout en conservant une entropie suffisante
 * pour 5 chars (~26 bits).
 */
const CAPTCHA_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

// ---------- helpers cryptographiques ----------

function getSecret(): string {
  const fromEnv = process.env.CAPTCHA_SECRET?.trim();
  if (fromEnv) return fromEnv;
  // Fallback dev UNIQUEMENT : dérive un secret stable depuis CWD pour qu'il
  // survive aux hot-reloads mais varie par projet. NE JAMAIS utiliser en prod.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CAPTCHA_SECRET manquant en production. Générer avec `openssl rand -hex 32` et le définir dans .env.prod.'
    );
  }
  return crypto.createHash('sha256').update(`eaumalik-captcha-dev:${process.cwd()}`).digest('hex');
}

function base64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf;
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function hmac(payload: string): string {
  return base64url(crypto.createHmac('sha256', getSecret()).update(payload).digest());
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// ---------- génération de la chaîne à deviner ----------

/** Tire un caractère aléatoire dans l'alphabet sûr. */
function randomChar(): string {
  const buf = crypto.randomBytes(1);
  return CAPTCHA_ALPHABET[buf[0] % CAPTCHA_ALPHABET.length];
}

/** Génère une chaîne CAPTCHA de longueur CAPTCHA_LENGTH. */
export function generateCaptchaAnswer(length = CAPTCHA_LENGTH): string {
  const out: string[] = [];
  for (let i = 0; i < length; i++) out.push(randomChar());
  return out.join('');
}

// ---------- génération du SVG ----------

interface RenderOpts {
  width?: number;
  height?: number;
  /** Seed pour rendre le rendu reproductible (utile pour les tests). */
  seed?: number;
}

/**
 * Génère un SVG déformé de la réponse donnée. Retourne { svg, answer }.
 * Si `seed` est fourni, le rendu est déterministe (utile pour snapshot testing).
 */
export function generateCaptchaSvg(answer?: string, opts: RenderOpts = {}): { svg: string; answer: string } {
  const finalAnswer = answer ?? generateCaptchaAnswer();
  const width = opts.width ?? 160;
  const height = opts.height ?? 60;
  const rng = opts.seed !== undefined ? mulberry32(opts.seed) : Math.random;

  // Le SVG est conçu pour rester lisible : chaque caractère est positionné dans
  // une "cellule" avec un jitter contrôlé, rotation modérée (-25°..+25°),
  // skew léger, et taille variable. Le bruit est faible pour rester accessible.
  const cellWidth = width / finalAnswer.length;
  let chars = '';

  for (let i = 0; i < finalAnswer.length; i++) {
    const ch = finalAnswer[i];
    const cx = cellWidth * i + cellWidth / 2 + (rng() - 0.5) * 6;
    const cy = height / 2 + (rng() - 0.5) * 8;
    const rot = (rng() - 0.5) * 50; // ±25°
    const fontSize = 30 + Math.floor(rng() * 8);
    const skewX = (rng() - 0.5) * 12;
    const fill = pickInk(rng);
    chars += `<text x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" `
      + `font-family="'Space Grotesk', 'Courier New', monospace" `
      + `font-size="${fontSize}" font-weight="700" fill="${fill}" `
      + `text-anchor="middle" dominant-baseline="middle" `
      + `transform="rotate(${rot.toFixed(1)} ${cx.toFixed(2)} ${cy.toFixed(2)}) skewX(${skewX.toFixed(1)})" `
      + `style="user-select:none">${escapeXml(ch)}</text>`;
  }

  // Lignes croisées : 4 segments, mixées sur toute la surface.
  let lines = '';
  for (let i = 0; i < 4; i++) {
    const x1 = rng() * width;
    const y1 = rng() * height;
    const x2 = rng() * width;
    const y2 = rng() * height;
    const stroke = pickInk(rng, 0.35);
    lines += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" `
      + `stroke="${stroke}" stroke-width="1.2" opacity="0.55" />`;
  }

  // Bruit : ~40 petits points semi-transparents.
  let dots = '';
  for (let i = 0; i < 40; i++) {
    const x = rng() * width;
    const y = rng() * height;
    const r = 0.5 + rng() * 1.1;
    const fill = pickInk(rng, 0.4);
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${fill}" opacity="0.6" />`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="CAPTCHA : retapez les ${finalAnswer.length} caractères affichés">`
    + `<rect width="100%" height="100%" fill="#f3efe0" />`
    + `<g>${lines}${dots}</g>`
    + `<g>${chars}</g>`
    + `</svg>`;

  return { svg, answer: finalAnswer };
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
      default: return c;
    }
  });
}

/** Couleur d'encre légèrement variable (autour du teal-700 brand) pour le bruit. */
function pickInk(rng: () => number, alpha = 1): string {
  const palette = ['#0f766e', '#115e59', '#134e4a', '#1c1917', '#0e7490'];
  const c = palette[Math.floor(rng() * palette.length)];
  if (alpha >= 1) return c;
  // Convertit #rrggbb en rgba(r,g,b,alpha).
  const r = parseInt(c.slice(1, 3), 16);
  const g = parseInt(c.slice(3, 5), 16);
  const b = parseInt(c.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
}

/** PRNG déterministe (Mulberry32) pour tests / seed explicite. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- signature / vérification du payload ----------

export interface CaptchaPayload {
  /** Réponse en clair (lowercased + trimmed côté vérification). */
  answer: string;
  /** Timestamp d'émission (ms epoch). */
  iat: number;
}

export type CaptchaVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'expired' | 'invalid' | 'tampered' };

/**
 * Signe un payload `{ answer, iat }` en token base64url compact :
 *   base64url(JSON({answer,iat})) + "." + base64url(hmac_sha256(secret, JSON))
 */
export function signCaptchaPayload(payload: CaptchaPayload): string {
  const body = base64url(JSON.stringify({ answer: payload.answer, iat: payload.iat }));
  const sig = hmac(body);
  return `${body}.${sig}`;
}

/**
 * Vérifie un token + une réponse soumise par l'utilisateur.
 * - `token` : valeur du cookie `eaumalik_captcha` (peut être null/undefined).
 * - `submitted` : valeur saisie par l'utilisateur (sera trim+lowercase).
 * Comparaison en temps constant. Le token est considéré comme « single-use »
 * côté appelant : le cookie doit être effacé après une vérification réussie.
 */
export function verifyCaptchaPayload(token: string | undefined | null, submitted: string | undefined | null): CaptchaVerifyResult {
  if (!token || !submitted) return { ok: false, reason: 'missing' };

  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'tampered' };
  const [body, sig] = parts;

  // Vérif signature d'abord (anti-tampering).
  const expectedSig = hmac(body);
  if (!timingSafeEqualStr(sig, expectedSig)) return { ok: false, reason: 'tampered' };

  // Décodage + expiration.
  let parsed: { answer?: string; iat?: number };
  try {
    parsed = JSON.parse(base64urlDecode(body).toString('utf8'));
  } catch {
    return { ok: false, reason: 'tampered' };
  }
  if (!parsed || typeof parsed.answer !== 'string' || typeof parsed.iat !== 'number') {
    return { ok: false, reason: 'tampered' };
  }
  const ageSec = (Date.now() - parsed.iat) / 1000;
  if (ageSec > CAPTCHA_TTL_SECONDS) return { ok: false, reason: 'expired' };

  // Comparaison answer (case-insensitive, trim).
  const expected = parsed.answer.toLowerCase().trim();
  const got = submitted.toLowerCase().trim();
  if (expected.length === 0 || got.length === 0) return { ok: false, reason: 'missing' };
  if (expected.length !== got.length) return { ok: false, reason: 'invalid' };
  if (!timingSafeEqualStr(expected, got)) return { ok: false, reason: 'invalid' };

  return { ok: true };
}

/** Indique si un `CAPTCHA_SECRET` explicite est configuré. */
export function isCaptchaProdSecretConfigured(): boolean {
  return !!process.env.CAPTCHA_SECRET?.trim();
}