'use server';

import 'server-only';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin, createSupabaseServiceRoleClient } from '@/lib/supabase/server';

const ProductSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().max(140).optional(),
  description: z.string().max(2000).nullable().optional(),
  price: z.number().nonnegative(),
  category: z.enum(['purificateurs', 'industriel', 'consommables']),
  image_url: z.string().url().nullable().optional(),
  specs: z.array(z.string()).nullable().optional(),
  is_featured: z.boolean(),
  stock: z.number().int().nonnegative(),
  stock_alert_threshold: z.number().int().nonnegative(),
  filter_lifespan_months: z.number().int().positive().nullable().optional(),
  wholesale_price: z.number().nonnegative().optional(),
  is_out_of_stock: z.boolean().optional(),
  is_archived: z.boolean().optional(),
});

export async function createProductAction(raw: unknown) {
  const parsed = ProductSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  try {
    await requireAdmin();
    const supabase = createSupabaseServiceRoleClient();
    const payload = {
      ...parsed.data,
      slug: parsed.data.slug || parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 100),
    };
    const { data, error } = await supabase.from('products').insert(payload).select().single();
    if (error || !data) throw error ?? new Error('Création échouée.');
    revalidatePath('/boutique');
    revalidatePath('/admin/catalogue');
    return { success: true as const, product: data };
  } catch (err: any) {
    return { success: false as const, error: err.message ?? 'Erreur.' };
  }
}

export async function updateProductAction(id: string, raw: unknown) {
  const parsed = ProductSchema.partial().safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  try {
    await requireAdmin();
    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from('products')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) throw error ?? new Error('Mise à jour échouée.');
    revalidatePath('/boutique');
    revalidatePath('/admin/catalogue');
    return { success: true as const, product: data };
  } catch (err: any) {
    return { success: false as const, error: err.message ?? 'Erreur.' };
  }
}

export async function deleteProductAction(id: string) {
  try {
    await requireAdmin();
    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    revalidatePath('/boutique');
    revalidatePath('/admin/catalogue');
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err.message ?? 'Erreur.' };
  }
}
