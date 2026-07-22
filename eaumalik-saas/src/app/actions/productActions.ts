'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  listProducts,
  adjustProductStock,
} from '@/data/repositories';
import { getOptionalUser } from '@/lib/supabase/server';
import { getDevUserFromCookie } from '@/lib/auth/devSession';

/**
 * Actions produits cote serveur.
 *
 * Fonctionnent en mode Supabase (prod) ET en mode mock (dev) :
 * le repository bascule automatiquement en fonction de l'env.
 *
 * Politique d'archivage :
 * - deleteProductAction() = soft delete (archive le produit)
 * - restoreProductAction() = restaure un produit archive
 * - purgeProductAction() = suppression definitive irreversible
 */

const ProductInputSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().max(140).optional(),
  description: z.string().max(2000).nullable().optional(),
  price: z.number().nonnegative(),
  category: z.enum(['purificateurs', 'industriel', 'consommables']),
  image_url: z.string().url().nullable().optional(),
  image_url_local: z.string().nullable().optional(),
  specs: z.array(z.string()).nullable().optional(),
  is_featured: z.boolean(),
  stock: z.number().int().nonnegative(),
  stock_alert_threshold: z.number().int().nonnegative().optional(),
  filter_lifespan_months: z.number().int().positive().nullable().optional(),
  wholesale_price: z.number().nonnegative().optional(),
  price_on_request: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  is_out_of_stock: z.boolean().optional(),
  is_archived: z.boolean().optional(),
});

/** Verifie que l'utilisateur est admin (ou bypasse en mode mock + superadmin cookie). */
async function ensureAdminOrMock(): Promise<{ ok: boolean; error?: string; role?: 'admin' | 'client' }> {
  const useMocks =
    process.env.NEXT_PUBLIC_USE_MOCKS === 'true' ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (useMocks) {
    // En mode mock on accepte (le superadmin a deja un cookie pose par /api/auth/dev-login)
    return { ok: true };
  }

  const user = await getOptionalUser();
  if (!user) return { ok: false, error: 'Authentification requise.' };
  if (user.role !== 'admin') return { ok: false, error: 'Droits admin requis.' };
  return { ok: true, role: user.role };
}

/** Vérifie le rôle superadmin strict (`admin`) pour les actions irréversibles. */
async function ensureSuperAdminOrMock(): Promise<{ ok: boolean; error?: string }> {
  const useMocks =
    process.env.NEXT_PUBLIC_USE_MOCKS === 'true' ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (useMocks) {
    const dev = await getDevUserFromCookie();
    // Sans session dev, le mode mock représente le superadmin de démonstration.
    if (dev && dev.role !== 'admin') {
      return { ok: false, error: 'Suppression définitive réservée au superadministrateur.' };
    }
    return { ok: true };
  }

  const user = await getOptionalUser();
  const realRole = user?.real_role ?? user?.role;
  if (!user) return { ok: false, error: 'Authentification requise.' };
  if (realRole !== 'admin') {
    return { ok: false, error: 'Suppression définitive réservée au superadministrateur.' };
  }
  return { ok: true };
}

/** Recupere le role effectif de l'appelant (mode mock : via cookie dev-login). */
async function getCallerRole(): Promise<'admin' | 'client' | null> {
  const dev = await getDevUserFromCookie();
  if (dev) {
    return (dev.role === 'admin' || dev.role === 'administrator') ? 'admin' : 'client';
  }
  const user = await getOptionalUser();
  return user?.role ?? null;
}

/**
 * Filtre le payload pour ne garder que les champs autorisés pour l'appelant.
 * Le prix d'achat en gros est reserve au super admin : si l'appelant n'est pas admin,
 * on retire le champ du payload pour eviter toute modification via l'API.
 */
function sanitizeProductPayloadForRole<T extends Record<string, any>>(
  payload: T,
  role: 'admin' | 'client' | null,
): T {
  if (role === 'admin') return payload;
  const { wholesale_price, ...rest } = payload;
  void wholesale_price;
  return rest as T;
}

export async function createProductAction(raw: unknown) {
  const parsed = ProductInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  const auth = await ensureAdminOrMock();
  if (!auth.ok) return { success: false as const, error: auth.error! };

  try {
    const data = parsed.data;
    const callerRole = await getCallerRole();
    // Defense en profondeur : un appelant non-admin ne peut pas fixer wholesale_price.
    const safeData = sanitizeProductPayloadForRole(data, callerRole);
    // En mock on accepte les data: URLs comme image_url_local
    const imageUrl =
      safeData.image_url_local ||
      safeData.image_url ||
      (process.env.NEXT_PUBLIC_USE_MOCKS === 'true'
        ? `/products/product-${Math.floor(Math.random() * 14) + 1}.jpeg`
        : null);

    const created = await createProduct({
      name: safeData.name,
      slug: safeData.slug || safeData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 100),
      description: safeData.description ?? null,
      price: safeData.price,
      category: safeData.category,
      image_url: imageUrl,
      specs: safeData.specs ?? [],
      is_featured: safeData.is_featured,
      stock: safeData.stock,
      stock_alert_threshold: safeData.stock_alert_threshold ?? 5,
      filter_lifespan_months: safeData.filter_lifespan_months ?? null,
      wholesale_price: safeData.wholesale_price ?? 0,
      price_on_request: safeData.price_on_request ?? false,
      sort_order: safeData.sort_order ?? 0,
      is_out_of_stock: safeData.is_out_of_stock ?? false,
      is_archived: safeData.is_archived ?? false,
    });
    revalidatePath('/boutique');
    revalidatePath('/admin/catalogue');
    return { success: true as const, product: created };
  } catch (err: any) {
    return { success: false as const, error: err.message ?? 'Erreur création.' };
  }
}

export async function updateProductAction(id: string, raw: unknown) {
  const parsed = ProductInputSchema.partial().safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  const auth = await ensureAdminOrMock();
  if (!auth.ok) return { success: false as const, error: auth.error! };

  try {
    const data = parsed.data;
    const callerRole = await getCallerRole();
    // Defense en profondeur : un appelant non-admin ne peut pas modifier wholesale_price.
    const safeData = sanitizeProductPayloadForRole(data, callerRole);
    const { image_url_local: imageUrlLocal, ...productData } = safeData;
    const imagePatch = imageUrlLocal
      ? { image_url: imageUrlLocal }
      : productData.image_url !== undefined
        ? { image_url: productData.image_url }
        : {};
    const updated = await updateProduct(id, {
      ...productData,
      ...imagePatch,
    });
    revalidatePath('/boutique');
    revalidatePath('/admin/catalogue');
    return { success: true as const, product: updated };
  } catch (err: any) {
    return { success: false as const, error: err.message ?? 'Erreur mise à jour.' };
  }
}

/**
 * Archive le produit (soft-delete). Le produit disparait de la boutique
 * mais reste en base et peut etre restaure via restoreProductAction.
 */
export async function deleteProductAction(id: string) {
  const auth = await ensureAdminOrMock();
  if (!auth.ok) return { success: false as const, error: auth.error! };

  try {
    const updated = await updateProduct(id, {
      is_archived: true,
    });
    revalidatePath('/boutique');
    revalidatePath('/admin/catalogue');
    return { success: true as const, product: updated };
  } catch (err: any) {
    return { success: false as const, error: err.message ?? 'Erreur archivage.' };
  }
}

/** Restaure un produit archive. */
export async function restoreProductAction(id: string) {
  const auth = await ensureAdminOrMock();
  if (!auth.ok) return { success: false as const, error: auth.error! };

  try {
    const updated = await updateProduct(id, {
      is_archived: false,
    });
    revalidatePath('/boutique');
    revalidatePath('/admin/catalogue');
    return { success: true as const, product: updated };
  } catch (err: any) {
    return { success: false as const, error: err.message ?? 'Erreur restauration.' };
  }
}

/** Suppression definitive d'un produit archive. Action irreversible. */
export async function purgeProductAction(id: string) {
  const auth = await ensureSuperAdminOrMock();
  if (!auth.ok) return { success: false as const, error: auth.error! };

  try {
    await deleteProduct(id);
    revalidatePath('/boutique');
    revalidatePath('/admin/catalogue');
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err.message ?? 'Erreur suppression.' };
  }
}

/** Liste tous les produits archives. */
export async function listArchivedProductsAction() {
  const auth = await ensureAdminOrMock();
  if (!auth.ok) return { success: false as const, error: auth.error!, products: [] };

  try {
    const products = await listProducts({ includeArchived: true });
    return { success: true as const, products: products.filter(p => p.is_archived) };
  } catch (err: any) {
    return { success: false as const, error: err.message ?? 'Erreur.', products: [] };
  }
}

/**
 * Réordonne plusieurs produits d'un coup (utilisé après un drag-and-drop
 * ou un déplacement haut/bas dans le tableau admin).
 *
 * @param items Liste [{ id: string, sort_order: number }, ...]
 *              dans le NOUVEL ordre souhaité. L'ordre fourni est appliqué tel quel.
 */
export async function reorderProductsAction(
  items: Array<{ id: string; sort_order: number }>,
) {
  const auth = await ensureAdminOrMock();
  if (!auth.ok) return { success: false as const, error: auth.error! };

  if (!Array.isArray(items) || items.length === 0) {
    return { success: false as const, error: 'Liste vide.' };
  }

  try {
    // Mise à jour séquentielle : une erreur sur un produit n'interrompt pas la boucle,
    // mais on retourne le détail des succès/échecs.
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const item of items) {
      try {
        if (!item?.id || typeof item.sort_order !== 'number') {
          results.push({ id: item?.id ?? '?', ok: false, error: 'Payload invalide.' });
          continue;
        }
        await updateProduct(item.id, { sort_order: item.sort_order });
        results.push({ id: item.id, ok: true });
      } catch (err: any) {
        results.push({ id: item.id, ok: false, error: err?.message ?? 'Erreur.' });
      }
    }
    const failed = results.filter(r => !r.ok);
    revalidatePath('/boutique');
    revalidatePath('/admin/catalogue');
    if (failed.length > 0) {
      return {
        success: false as const,
        error: `${failed.length} produit(s) non mis à jour.`,
        results,
      };
    }
    return { success: true as const, results };
  } catch (err: any) {
    return { success: false as const, error: err.message ?? 'Erreur réordonnancement.' };
  }
}

/**
 * Enregistre un MOUVEMENT de stock pour un produit (entrée, sortie,
 * correction) avec motif et note. Action réservée aux administrateurs.
 *
 * Le formulaire côté UI envoie TOUJOURS une quantité POSITIVE + un signe
 * (entrée / sortie) + un motif. Le service calcule le delta signé en
 * fonction du motif (`restock`/`return` → +N, `direct_sale`/`loss` → -N)
 * ou du signe libre (`correction`/`other`, avec note obligatoire).
 *
 * Validation :
 *  - delta entier non-zéro (|delta| ≤ 100 000)
 *  - restock_date au format YYYY-MM-DD
 *  - reason ∈ {restock, return, direct_sale, correction, loss, other}
 *  - reason ∈ {correction, other} ⇒ note obligatoire
 */
const MovementInputSchema = z.object({
  /** Signe du mouvement côté UI : +1 = entrée, -1 = sortie. Combiné à |quantity|. */
  direction: z.number().int().min(-1).max(1),
  quantity: z.number().int().positive('Quantité doit être > 0').max(100_000),
  restock_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date au format YYYY-MM-DD requise.'),
  reason: z.enum(['restock', 'return', 'direct_sale', 'correction', 'loss', 'other']),
  note: z.string().max(500).optional().nullable(),
  /** Localité impactée (migration 0014). Optionnel : si absent, maj directe
   *  de products.stock (legacy). */
  locality_id: z.string().uuid('Identifiant de localité invalide.').optional().nullable(),
});

export async function adjustProductStockAction(
  productId: string,
  raw: unknown,
) {
  const id = String(productId ?? '').slice(0, 80);
  if (!id) return { success: false as const, error: 'Produit invalide.' };

  const parsed = MovementInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  const auth = await ensureAdminOrMock();
  if (!auth.ok) return { success: false as const, error: auth.error! };

  try {
    // Auteur effectif : on tente de récupérer le mail admin (Supabase ou cookie dev).
    let createdBy: string | null = null;
    const dev = await getDevUserFromCookie();
    if (dev) createdBy = dev.email ?? null;
    else {
      const u = await getOptionalUser();
      createdBy = u?.email ?? null;
    }

    // Calcul du delta signé : pour les motifs contraints on utilise le signe
    // du motif, pour les motifs ambigus on prend `direction` (entrée/sortie).
    let delta: number;
    const abs = Math.trunc(parsed.data.quantity);
    switch (parsed.data.reason) {
      case 'restock':
      case 'return':
        delta = abs;
        break;
      case 'direct_sale':
      case 'loss':
        delta = -abs;
        break;
      case 'correction':
      case 'other':
        delta = parsed.data.direction > 0 ? abs : -abs;
        break;
    }

    const result = await adjustProductStock(id, {
      delta,
      restock_date: parsed.data.restock_date,
      reason: parsed.data.reason,
      note: parsed.data.note ?? null,
      created_by: createdBy,
      locality_id: parsed.data.locality_id ?? null,
    });

    revalidatePath('/boutique');
    revalidatePath('/admin/catalogue');
    revalidatePath('/admin/locations');
    revalidatePath('/admin/stocks');
    return { success: true as const, product: result.product, event: result.event };
  } catch (err: any) {
    return { success: false as const, error: err?.message ?? 'Erreur mouvement de stock.' };
  }
}
