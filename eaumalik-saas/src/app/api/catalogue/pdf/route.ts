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
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getCataloguePdfBuffer, getCataloguePdf } from '@/data/repositories';

// On garde la route dynamique : pas de pré-rendu côté build (le binaire
// n'est pas dispo au build time, et on veut le cache HTTP court).
export const dynamic = 'force-dynamic';

const CACHE_HEADERS = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
const STORAGE_TIMEOUT_MS = 8_000;

async function readUploadedPdfSafely() {
  try {
    return await Promise.race([
      getCataloguePdfBuffer(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), STORAGE_TIMEOUT_MS)),
    ]);
  } catch {
    // Le PDF public doit continuer à fonctionner même si Supabase/Storage est
    // momentanément indisponible ou si la configuration serveur est incomplète.
    return null;
  }
}

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
  const buf = await readUploadedPdfSafely();
  if (buf && buf.length > 0) {
    let meta = null;
    try {
      meta = await getCataloguePdf();
    } catch {
      // Le binaire reste servable même si la lecture des métadonnées échoue.
    }
    const total = buf.length;
    const range = parseRange(req.headers.get('range'), total);

    const headers = new Headers();
    headers.set('Content-Type', meta?.mime || 'application/pdf');
    const filename = (meta?.filename || 'catalogue.pdf').replace(/[\r\n"\\]/g, '_');
    headers.set('Content-Disposition', `inline; filename="${filename}"`);
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

  // 2) Fallback : lecture directe depuis public/. Le service direct est
  // important en standalone : le process tourne dans un dossier différent
  // et une redirection vers un fichier absent dans l'artefact provoquerait un
  // 404 au lieu d'afficher le catalogue livré avec l'application.
  try {
    const fallback = await readFile(
      path.join(process.cwd(), 'public', 'catalogue', 'Catalogue_EauMalik.pdf'),
    );
    const total = fallback.length;
    const range = parseRange(req.headers.get('range'), total);
    const headers = new Headers({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="Catalogue_EauMalik.pdf"',
      'Cache-Control': CACHE_HEADERS,
      'X-Catalogue-Source': 'public-fallback',
      'Accept-Ranges': 'bytes',
    });
    if (range) {
      const slice = fallback.subarray(range.start, range.end + 1);
      headers.set('Content-Range', `bytes ${range.start}-${range.end}/${total}`);
      headers.set('Content-Length', String(slice.length));
      return new NextResponse(new Uint8Array(slice), { status: 206, headers });
    }
    headers.set('Content-Length', String(total));
    return new NextResponse(new Uint8Array(fallback), { status: 200, headers });
  } catch {
    return NextResponse.json(
      { error: 'Catalogue PDF indisponible.', code: 'catalogue_pdf_missing' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
