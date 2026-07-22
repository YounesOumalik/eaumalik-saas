'use server';

/**
 * Server Actions pour la gestion du PDF catalogue (flipbook landing page).
 *
 * L'admin (superadmin OU administrateur) peut :
 *   - remplacer le PDF courant (upload d'un nouveau fichier)
 *   - supprimer le PDF courant (retombe sur le fallback public/)
 *
 * Côté Supabase, l'écriture passe par le service role (bypass RLS).
 * En mode mock, on bypass l'auth — la session dev est garantie par le
 * middleware admin layout.
 *
 * Le payload binaire transite en `ArrayBuffer` (File côté client) puis est
 * converti en `Buffer` Node pour être écrit soit sur disque
 * (data-store/catalogue.pdf), soit upserté en base64 bytea (Supabase).
 */

import 'server-only';
import { revalidatePath } from 'next/cache';
import { saveCataloguePdf, deleteCataloguePdfRecord, getCataloguePdf } from '@/data/repositories';
import { requireAdmin } from '@/lib/supabase/server';
import { isMockMode } from '@/lib/api-guard';
import {
  CATALOGUE_PDF_MAX_SIZE,
  isLikelyPdf,
  sanitizeFilename,
} from '@/data/cataloguePdf';

async function gate() {
  if (isMockMode()) {
    return {
      id: 'mock-admin',
      email: 'mock@admin.local',
      role: 'admin' as const,
      full_name: 'Mock Admin',
    };
  }
  return await requireAdmin();
}

/**
 * Remplace le PDF catalogue courant par celui fourni par l'admin.
 *
 * @param formData FormData multipart contenant :
 *   - `file`        : File (obligatoire) — PDF <= 25 Mo
 *   - `displayName` : string (optionnel) — nom affiché (sinon = nom de fichier)
 */
export async function uploadCataloguePdfAction(formData: FormData) {
  try {
    await gate();

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return { success: false as const, error: 'Aucun fichier reçu.' };
    }
    if (file.size > CATALOGUE_PDF_MAX_SIZE) {
      const mo = (CATALOGUE_PDF_MAX_SIZE / (1024 * 1024)).toFixed(0);
      return { success: false as const, error: `Fichier trop volumineux (max ${mo} Mo).` };
    }

    const displayNameRaw = (formData.get('displayName') ?? '').toString();
    const filenameSanitized = sanitizeFilename(displayNameRaw || file.name);

    // Conversion File -> ArrayBuffer -> Buffer (Node) pour pouvoir écrire.
    const arrayBuf = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    if (!isLikelyPdf(buf)) {
      return {
        success: false as const,
        error: 'Le fichier fourni ne semble pas être un PDF valide (header %PDF manquant).',
      };
    }

    const user = await gate();
    const record = await saveCataloguePdf(
      buf,
      {
        filename: filenameSanitized,
        mime: 'application/pdf',
        size: buf.length,
      },
      user?.email ?? null,
    );

    revalidatePath('/');
    revalidatePath('/admin/catalogue');

    return { success: true as const, record };
  } catch (err: any) {
    return { success: false as const, error: err?.message ?? 'Erreur inconnue.' };
  }
}

/** Supprime le PDF catalogue courant (retombe sur le fallback public/). */
export async function deleteCataloguePdfAction() {
  try {
    await gate();
    await deleteCataloguePdfRecord();
    revalidatePath('/');
    revalidatePath('/admin/catalogue');
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err?.message ?? 'Erreur inconnue.' };
  }
}

/** Lit les métadonnées du PDF courant (utilisé pour pré-remplir l'UI admin). */
export async function getCataloguePdfAction() {
  try {
    await gate();
    const record = await getCataloguePdf();
    return { success: true as const, record };
  } catch (err: any) {
    return { success: false as const, error: err?.message ?? 'Erreur inconnue.' };
  }
}
