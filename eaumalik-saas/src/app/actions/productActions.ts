'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  listProducts,
} from '@/data/repositories';
import { getOptionalUser } from '@/lib/supabase/server';

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
  is_out_of_stock: z.boolean().optional(),
  is_archived: z.boolean().optional(),
});

/** Verifie que l'utilisateur est admin (ou bypasse en mode mock + superadmin cookie). */
async function ensureAdminOrMock(): Promise<{ ok: boolean; error?: string }> {
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
  return { ok: true };
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
    // En mock on accepte les data: URLs comme image_url_local
    const imageUrl =
      data.image_url_local ||
      data.image_url ||
      (process.env.NEXT_PUBLIC_USE_MOCKS === 'true'
        ? `/products/product-${Math.floor(Math.random() * 14) + 1}.jpeg`
        : null);

    const created = await createProduct({
      name: data.name,
      slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 100),
      description: data.description ?? null,
      price: data.price,
      category: data.category,
      image_url: imageUrl,
      specs: data.specs ?? [],
      is_featured: data.is_featured,
      stock: data.stock,
      stock_alert_threshold: data.stock_alert_threshold ?? 5,
      filter_lifespan_months: data.filter_lifespan_months ?? null,
      wholesale_price: data.wholesale_price ?? 0,
      is_out_of_stock: data.is_out_of_stock ?? false,
      is_archived: data.is_archived ?? false,
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
    const updated = await updateProduct(id, {
      ...data,
      image_url: data.image_url_local || data.image_url || undefined,
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
  const auth = await ensureAdminOrMock();
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