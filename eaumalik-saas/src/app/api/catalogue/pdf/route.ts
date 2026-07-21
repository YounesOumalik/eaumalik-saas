/**
 * GET /api/catalogue/pdf
 *
 * Sert le PDF catalogue courant (uploadé par l'admin) au navigateur.
 * - Source : `data-store/catalogue.pdf` (mock) ou table `eaumalik.catalogue_pdf` (Supabase).
 * - Fallback : `/catalogue/Catalogue_EauMalik.pdf` (copié dans `public/` au build Docker).
 * - Cache : 5 min côté client, 1h côté CDN, stale-while-revalidate 24h.
 *   L'admin qui upload un nouveau PDF déclenche `revalidatePath('/')` côté
 *   Server Action → le navigateur recevra la nouvelle version au prochain fetch.
 *
 * Range requests : on supporte `Range: bytes=X-Y` pour permettre à pdfjs
 * de charger le PDF **par chunks progressifs** (64 KB par défaut, cf.
 * `rangeChunkSize` côté client). La 1re page s'affiche ainsi en ~200ms
 * au lieu d'attendre les 1.2 Mo complets.
 *
 * Pas d'auth : le PDF est volontairement public (c'est ce qui est feuilleté
 * par les visiteurs sur la landing page). Les MÉTADONNÉES (filename, size,
 * uploadedBy) ne sont PAS exposées par cette route — uniquement par
 * `getCataloguePdfAction` (côté admin).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getCataloguePdfBuffer, getCataloguePdf } from '@/data/repositories';

// On garde la route dynamique : pas de pré-rendu côté build (le binaire
// n'est pas dispo au build time, et on veut le cache HTTP court).
export const dynamic = 'force-dynamic';

const CACHE_HEADERS = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

/**
 * Parse un en-tête Range: bytes=X-Y en [start, end] (inclusifs).
 * Retourne null si l'en-tête est absent ou mal formé.
 */
function parseRange(
  header: string | null,
  totalSize: number,
): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, startStr, endStr] = match;
  let start: number;
  let end: number;
  if (startStr === '' && endStr !== '') {
    // suffix range : bytes=-N → les N derniers octets
    const suffix = Number(endStr);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else if (startStr !== '' && endStr === '') {
    // open-ended : bytes=X- → de X jusqu'à la fin
    start = Number(startStr);
    end = totalSize - 1;
  } else if (startStr !== '' && endStr !== '') {
    start = Number(startStr);
    end = Number(endStr);
  } else {
    return null;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < start || start >= totalSize) return null;
  if (end >= totalSize) end = totalSize - 1;
  return { start, end };
}

export async function GET(req: NextRequest) {
  // 1) Essai lecture PDF uploadé par l'admin.
  const buf = await getCataloguePdfBuffer();
  if (buf && buf.length > 0) {
    const meta = await getCataloguePdf();
    const total = buf.length;
    const range = parseRange(req.headers.get('range'), total);

    const headers = new Headers();
    headers.set('Content-Type', meta?.mime || 'application/pdf');
    headers.set('Content-Disposition', `inline; filename="${meta?.filename || 'catalogue.pdf'}"`);
    headers.set('Cache-Control', CACHE_HEADERS);
    headers.set('X-Catalogue-Source', 'admin-upload');
    // Support des Range requests (pdfjs charge en chunks progressifs).
    headers.set('Accept-Ranges', 'bytes');

    if (range) {
      const slice = buf.subarray(range.start, range.end + 1);
      headers.set('Content-Range', `bytes ${range.start}-${range.end}/${total}`);
      headers.set('Content-Length', String(slice.length));
      return new NextResponse(new Uint8Array(slice), { status: 206, headers });
    }
    headers.set('Content-Length', String(total));
    return new NextResponse(new Uint8Array(buf), { status: 200, headers });
  }

  // 2) Fallback : fichier statique embarqué dans `public/` au build Docker.
  // On évite un fs.readFileSync ici pour rester compatible avec
  // `output: 'standalone'` : Next.js ne bundlera pas le fallback dans
  // l'image standalone, mais le binaire reste servi via l'URL statique.
  // L'URL absolue est construite via getAppOrigin() (cf. fix O-03 origin)
  // pour respecter l'hôte public (eaumalik.com) derrière le reverse-proxy,
  // plutôt que de tomber sur http://0.0.0.0:3100 ou localhost.
  const { getAppOrigin } = await import('@/lib/app-origin');
  const fallbackUrl = new URL('/catalogue/Catalogue_EauMalik.pdf', getAppOrigin());
  return NextResponse.redirect(fallbackUrl, {
    status: 302,
    headers: {
      'Cache-Control': CACHE_HEADERS,
      'X-Catalogue-Source': 'public-fallback',
    },
  });
}
