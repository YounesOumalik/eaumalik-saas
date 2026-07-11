'use server';

import 'server-only';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin, createSupabaseServiceRoleClient } from '@/lib/supabase/server';

const PermissionsSchema = z.object({
  can_view_products: z.boolean(),
  can_edit_products: z.boolean(),
  can_validate_orders: z.boolean(),
  can_follow_prospects: z.boolean(),
  can_view_comptabilite: z.boolean(),
  can_view_stocks: z.boolean(),
});

const StaffCreateSchema = z.object({
  email: z.string().email('Email invalide.'),
  password: z.string()
    .min(8, 'Mot de passe trop court (min. 8 caractères).')
    .regex(/[A-Z]/, 'Doit contenir une majuscule.')
    .regex(/[0-9]/, 'Doit contenir un chiffre.'),
  full_name: z.string().min(3).max(100),
  phone: z.string().regex(/^0[6-7][0-9]{8}$/, 'Numéro marocain invalide.'),
  role: z.string().min(1).max(40),
  permissions: PermissionsSchema,
});

const StaffUpdateSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(3).max(100),
  phone: z.string().regex(/^0[6-7][0-9]{8}$/),
  role: z.string().min(1).max(40),
  password: z.string()
    .min(8, 'Mot de passe trop court (min. 8 caractères).')
    .regex(/[A-Z]/, 'Doit contenir une majuscule.')
    .regex(/[0-9]/, 'Doit contenir un chiffre.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  permissions: PermissionsSchema,
});

async function gate() {
  return await requireAdmin();
}

export async function listStaffUsersAction() {
  try {
    await gate();
    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, phone, role, permissions, created_at, updated_at')
      .neq('role', 'client')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { success: true as const, staff: data ?? [] };
  } catch (err: any) {
    return { success: false as const, error: err.message ?? 'Erreur.' };
  }
}

export async function createStaffUserAction(raw: unknown) {
  const parsed = StaffCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  try {
    await gate();
    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.full_name, phone: parsed.data.phone },
    });
    if (error || !data.user) throw error ?? new Error('Création échouée.');
    const { error: upsertErr } = await supabase.from('users').upsert({
      id: data.user.id,
      email: parsed.data.email,
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      role: parsed.data.role,
      permissions: parsed.data.permissions,
    });
    if (upsertErr) throw upsertErr;
    revalidatePath('/admin/personnels');
    return { success: true as const, staff: data.user };
  } catch (err: any) {
    return { success: false as const, error: err.message ?? 'Erreur.' };
  }
}

export async function updateStaffUserAction(id: string, raw: unknown) {
  const parsed = StaffUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  try {
    await gate();
    const supabase = createSupabaseServiceRoleClient();
    const update: Record<string, unknown> = {
      email: parsed.data.email,
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      role: parsed.data.role,
      permissions: parsed.data.permissions,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('users').update(update).eq('id', id);
    if (error) throw error;
    if (parsed.data.password && parsed.data.password.length >= 8) {
      const { error: pwdErr } = await supabase.auth.admin.updateUserById(id, { password: parsed.data.password });
      if (pwdErr) throw pwdErr;
    }
    revalidatePath('/admin/personnels');
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err.message ?? 'Erreur.' };
  }
}

export async function deleteStaffUserAction(id: string) {
  try {
    const admin = await gate();
    if (id === admin.id) {
      return {
        success: false as const,
        error: 'Vous ne pouvez pas supprimer votre propre compte administrateur.',
      };
    }
    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;
    await supabase.from('users').delete().eq('id', id);
    revalidatePath('/admin/personnels');
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err.message ?? 'Erreur.' };
  }
}
