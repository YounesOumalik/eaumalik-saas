'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createNews, updateNews, deleteNews } from '@/data/repositories';
import { requireAdmin } from '@/lib/supabase/server';

const NewsInputSchema = z.object({
  title: z.string().min(3, 'Titre trop court (min. 3 caractères).').max(160, 'Titre trop long.'),
  content: z.string().min(5, 'Contenu trop court (min. 5 caractères).').max(4000, 'Contenu trop long.'),
  image_url: z
    .string()
    .url('URL d’image invalide.')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  price: z.number().nonnegative('Prix invalide.').nullable().optional(),
  original_price: z.number().nonnegative('Prix d’origine invalide.').nullable().optional(),
  product_ids: z.array(z.string()).optional(),
  target_all: z.boolean().optional(),
  target_user_ids: z.array(z.string()).optional(),
  is_promotion: z.boolean().optional(),
  valid_until: z
    .string()
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
});

function isMockMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_USE_MOCKS === 'true' ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

async function gate() {
  // En mode mock (data-store JSON) on bypass l'auth Supabase — la session
  // dev est déjà garantie par le middleware/admin layout.
  if (isMockMode()) {
    return { id: 'mock-admin', email: 'mock@admin.local', role: 'admin' as const, full_name: 'Mock Admin' };
  }
  return await requireAdmin();
}

export async function createNewsAction(raw: unknown) {
  const parsed = NewsInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  try {
    await gate();
    const data = parsed.data;
    const created = await createNews({
      title: data.title,
      content: data.content,
      image_url: data.image_url ?? null,
      price: data.price ?? null,
      original_price: data.original_price ?? null,
      product_ids: data.product_ids ?? [],
      target_all: data.target_all ?? true,
      target_user_ids: data.target_user_ids ?? [],
      is_promotion: data.is_promotion ?? false,
      valid_until: data.valid_until ?? null,
    });
    revalidatePath('/admin/actualites');
    revalidatePath('/');
    revalidatePath('/boutique');
    return { success: true as const, news: created };
  } catch (err: any) {
    return { success: false as const, error: err?.message ?? 'Erreur inconnue.' };
  }
}

export async function updateNewsAction(id: string, raw: unknown) {
  const parsed = NewsInputSchema.partial().safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  try {
    await gate();
    const data = parsed.data;
    const patch: Partial<Omit<import('@/types').News, 'id' | 'created_at'>> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.content !== undefined) patch.content = data.content;
    if (data.image_url !== undefined) patch.image_url = data.image_url;
    if (data.price !== undefined) patch.price = data.price;
    if (data.original_price !== undefined) patch.original_price = data.original_price;
    if (data.product_ids !== undefined) patch.product_ids = data.product_ids;
    if (data.target_all !== undefined) patch.target_all = data.target_all;
    if (data.target_user_ids !== undefined) patch.target_user_ids = data.target_user_ids;
    if (data.is_promotion !== undefined) patch.is_promotion = data.is_promotion;
    if (data.valid_until !== undefined) patch.valid_until = data.valid_until;

    const updated = await updateNews(id, patch);
    revalidatePath('/admin/actualites');
    revalidatePath('/');
    revalidatePath('/boutique');
    return { success: true as const, news: updated };
  } catch (err: any) {
    return { success: false as const, error: err?.message ?? 'Erreur inconnue.' };
  }
}

export async function deleteNewsAction(id: string) {
  try {
    await gate();
    await deleteNews(id);
    revalidatePath('/admin/actualites');
    revalidatePath('/');
    revalidatePath('/boutique');
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err?.message ?? 'Erreur inconnue.' };
  }
}
