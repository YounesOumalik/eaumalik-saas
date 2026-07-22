// ============================================================================
// Catalogue PDF — gestion du PDF "feuilletable" affiché sur la landing page.
//
// Source de vérité (mode mock) : `data-store/catalogue_pdf.json` (métadonnées
// du dernier PDF uploadé par l'admin) + `data-store/catalogue.pdf` (binaire).
//
// En mode Supabase (prod), les fonctions de `repositories.ts` lisent/écrivent
// via le service role (cf. `data-store/catalogue_pdf.json` est alors purement
// indicatif et n'est pas utilisé).
//
// Le PDF est volontairement stocké en MOCK sur disque (pas dans le bundle
// Next.js) pour permettre aux admins de le remplacer à chaud via l'UI
// d'administration sans rebuild l'image Docker. Le fichier "fallback" vit
// dans `public/catalogue/Catalogue_EauMalik.pdf` (copié à l'image) et n'est
// servi QUE si aucun PDF n'a été uploadé.
// ============================================================================

import 'server-only';
import fs from 'fs';
import path from 'path';
import { CATALOGUE_PDF_MAX_SIZE } from '@/config/cataloguePdf';

const DB_DIR = path.join(process.cwd(), 'data-store');

/**
 * Métadonnées du PDF catalogue. On stocke :
 *   - filename : nom de fichier d'origine (sanitizé, sans path)
 *   - mime : 'application/pdf' (par convention ; le validator côté action
 *            vérifie que le contenu commence par %PDF)
 *   - size : taille en octets
 *   - uploadedAt : ISO timestamp du dernier upload
 *   - uploadedBy : id/email de l'auteur (admin) — informatif
 */
export interface CataloguePdfMeta {
  filename: string;
  mime: string;
  size: number;
  uploadedAt: string;
  uploadedBy?: string | null;
}

const META_FILE = path.join(DB_DIR, 'catalogue_pdf.json');
const PDF_FILE = path.join(DB_DIR, 'catalogue.pdf');
// Plafond à 8 Mo : permet un PDF catalogue de 12-30 pages en haute qualité
// (images 150-200 dpi). Au-delà, on perd en fluidité d'affichage (téléchargement
// + rendu pdfjs) pour un gain de qualité marginal. Le PDF d'origine (3.3 Mo)
// passe à 1.2 Mo après une compression /screen ghostscript — on encourage
// l'admin à optimiser le PDF avant upload.
/** Regex stricte pour le nom de fichier : lettres/chiffres/tirets/underscore/espaces/points. */
const FILENAME_REGEX = /^[a-zA-Z0-9 _.\-()À-ÿ]{1,200}$/;

/** Sanitize un nom de fichier (retire path, garde uniquement le basename). */
export function sanitizeFilename(name: string): string {
  const base = path.basename(name || '').trim();
  // Forcer l'extension .pdf
  const noExt = base.replace(/\.pdf$/i, '');
  const cleaned = noExt.replace(/[^a-zA-Z0-9 _\-()À-ÿ]/g, '_').slice(0, 180);
  return `${cleaned || 'Catalogue'}.pdf`;
}

/** Vérifie qu'un buffer ressemble à un PDF (%PDF en tête). */
export function isLikelyPdf(buf: Buffer): boolean {
  if (!buf || buf.length < 5) return false;
  // %PDF- suivi d'un chiffre (1.x) — header PDF standard.
  return buf.subarray(0, 5).toString('utf8') === '%PDF-';
}

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
}

/** Lit les métadonnées du PDF courant (ou null si aucun n'a été uploadé). */
export function readCataloguePdfMeta(): CataloguePdfMeta | null {
  try {
    const raw = fs.readFileSync(META_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as CataloguePdfMeta;
  } catch {
    return null;
  }
}

/** Lit le buffer du PDF courant (ou null). */
export function readCataloguePdfBuffer(): Buffer | null {
  try {
    if (!fs.existsSync(PDF_FILE)) return null;
    return fs.readFileSync(PDF_FILE);
  } catch {
    return null;
  }
}

/** Écrit un nouveau PDF (buffer + métadonnées). Écrase l'éventuel précédent. */
export function writeCataloguePdf(buf: Buffer, meta: CataloguePdfMeta): void {
  ensureDir();
  fs.writeFileSync(PDF_FILE, buf);
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
}

/** Supprime le PDF courant (et ses métadonnées). */
export function deleteCataloguePdf(): void {
  try {
    if (fs.existsSync(PDF_FILE)) fs.unlinkSync(PDF_FILE);
    if (fs.existsSync(META_FILE)) fs.unlinkSync(META_FILE);
  } catch {
    // silencieux — la suppression idempotente ne doit pas casser l'UI.
  }
}

export { CATALOGUE_PDF_MAX_SIZE };
export const CATALOGUE_PDF_FILENAME_REGEX = FILENAME_REGEX;
