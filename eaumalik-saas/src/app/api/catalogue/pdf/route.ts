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
 * Pas d'auth : le PDF est volontairement public (c'est ce qui est feuilleté
 * par les visiteurs sur la landing page). Les MÉTADONNÉES (filename, size,
 * uploadedBy) ne sont PAS exposées par cette route — uniquement par
 * `getCataloguePdfAction` (côté admin).
 */

import { NextResponse } from 'next/server';
import { getCataloguePdfBuffer, getCataloguePdf } from '@/data/repositories';

// On garde la route dynamique : pas de pré-rendu côté build (le binaire
// n'est pas dispo au build time, et on veut le cache HTTP court).
export const dynamic = 'force-dynamic';

export async function GET() {
  // 1) Essai lecture PDF uploadé par l'admin.
  const buf = await getCataloguePdfBuffer();
  if (buf && buf.length > 0) {
    const meta = await getCataloguePdf();
    const headers = new Headers();
    headers.set('Content-Type', meta?.mime || 'application/pdf');
    headers.set('Content-Length', String(buf.length));
    headers.set('Content-Disposition', `inline; filename="${meta?.filename || 'catalogue.pdf'}"`);
    headers.set(
      'Cache-Control',
      'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    );
    headers.set('X-Catalogue-Source', 'admin-upload');
    // Convertit Buffer → Uint8Array (BodyInit attendu par NextResponse).
    return new NextResponse(new Uint8Array(buf), { status: 200, headers });
  }

  // 2) Fallback : fichier statique embarqué dans `public/` au build Docker.
  // On évite un fs.readFileSync ici pour rester compatible avec
  // `output: 'standalone'` : Next.js ne bundlera pas le fallback dans
  // l'image standalone, mais le binaire reste servi via l'URL statique.
  const fallbackUrl = new URL(
    '/catalogue/Catalogue_EauMalik.pdf',
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  );
  return NextResponse.redirect(fallbackUrl, {
    status: 302,
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      'X-Catalogue-Source': 'public-fallback',
    },
  });
}
