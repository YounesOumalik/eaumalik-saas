'use server';

import 'server-only';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import {
  archiveStaff,
  getArchivedStaff,
  removeArchivedStaff,
  listArchivedStaff,
  readUsersRaw,
  writeUsersRaw,
} from '@/data/repositories';

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
  phone: z.string().regex(/^0[6-7][0-9]{8}$/, 'Numéro marocain invalide.').optional().or(z.literal('')),
  role: z.string().min(1).max(40),
  permissions: PermissionsSchema,
});

const StaffUpdateSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(3).max(100),
  phone: z.string().regex(/^0[6-7][0-9]{8}$/).optional().or(z.literal('')),
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
  // En mode mock (data-store JSON) on bypass l'auth Supabase — la session
  // dev est déjà garantie par le middleware/admin layout. Cf. ensureAdminOrMock
  // dans productActions.ts pour le même pattern.
  if (isMockMode()) {
    return { id: 'mock-admin', email: 'mock@admin.local', role: 'admin' as const, real_role: 'admin', full_name: 'Mock Admin' };
  }
  return await requireAdmin();
}

/** En mode mock on n'instancie jamais le Service Role (qui throw sans clé). */
function isMockMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_USE_MOCKS === 'true' ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

function getSupabaseOrThrow() {
  if (isMockMode()) {
    throw new Error('Mode mock : utilisez les helpers de repositories (read/write local).');
  }
  return createSupabaseServiceRoleClient();
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
    const { error: upsertErr } = await supabase.from('users').upsert(
      {
        id: data.user.id,
        email: parsed.data.email,
        full_name: parsed.data.full_name,
        phone: parsed.data.phone || null,
        role: parsed.data.role,
        permissions: parsed.data.permissions,
      },
      { onConflict: 'id' }
    );
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

    // Un Administrateur (non-super) ne peut pas supprimer un Superadministrateur
    const adminRealRole = (admin as any).real_role ?? admin.role;
    if (adminRealRole === 'administrator') {
      // Vérifie le rôle de la cible avant suppression
      let targetRole: string | null = null;
      if (isMockMode()) {
        const u = (await readUsersRaw()).find((x: any) => x.id === id);
        targetRole = u?.role ?? null;
      } else {
        const supabase = createSupabaseServiceRoleClient();
        const { data } = await supabase.from('users').select('role').eq('id', id).maybeSingle();
        targetRole = data?.role ?? null;
      }
      if (targetRole === 'admin') {
        return {
          success: false as const,
          error: 'Un Administrateur ne peut pas supprimer le Superadministrateur.',
        };
      }
    }

    // 1) Récupère le profil complet AVANT suppression (snapshot pour archive)
    let profile: {
      id: string; email: string; full_name: string; phone: string | null;
      role: string; permissions: Record<string, boolean> | null;
      created_at: string | null; updated_at: string | null;
    } | null = null;

    if (isMockMode()) {
      const u = (await readUsersRaw()).find((x: any) => x.id === id);
      if (!u) return { success: false as const, error: 'Compte introuvable.' };
      profile = {
        id: u.id, email: u.email, full_name: u.full_name, phone: u.phone ?? null,
        role: u.role, permissions: u.permissions ?? null,
        created_at: u.created_at ?? null, updated_at: u.updated_at ?? null,
      };
    } else {
      const supabase = createSupabaseServiceRoleClient();
      const { data, error: readErr } = await supabase
        .from('users')
        .select('id, email, full_name, phone, role, permissions, created_at, updated_at')
        .eq('id', id)
        .maybeSingle();
      if (readErr) throw readErr;
      profile = data;
    }

    if (!profile) return { success: false as const, error: 'Compte introuvable.' };
    if (profile.role === 'client') {
      return { success: false as const, error: 'Impossible d\'archiver un compte client.' };
    }

    // 2) Snapshot vers l'archive (écrit dans users_archive.json en mock, table Supabase sinon)
    await archiveStaff(profile, 'Suppression manuelle depuis la gestion du personnel');

    // 3) Suppression effective de l'utilisateur (auth + profil)
    if (isMockMode()) {
      const remaining = (await readUsersRaw()).filter((u: any) => u.id !== id);
      await writeUsersRaw(remaining);
    } else {
      const supabase = createSupabaseServiceRoleClient();
      const { error: authErr } = await supabase.auth.admin.deleteUser(id);
      if (authErr) throw authErr;
      await supabase.from('users').delete().eq('id', id);
    }

    revalidatePath('/admin/personnels');
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err.message ?? 'Erreur.' };
  }
}

// ----------------------------------------------------------------------------
// ARCHIVES personnel (récupération de comptes supprimés)
// ----------------------------------------------------------------------------

/** Liste tous les comptes personnel archivés. */
export async function listArchivedStaffAction() {
  try {
    await gate();
    const list = await listArchivedStaff();
    return { success: true as const, archived: list };
  } catch (err: any) {
    return { success: false as const, error: err.message ?? 'Erreur.', archived: [] };
  }
}

/**
 * Restaure un compte personnel archivé.
 * - recrée l'utilisateur auth avec un nouveau mot de passe (obligatoire)
 * - réinsert le profil users avec son id d'origine
 * - supprime le snapshot de l'archive
 */
const RestoreSchema = z.object({
  id: z.string().min(1),
  newPassword: z.string()
    .min(8, 'Mot de passe trop court (min. 8 caractères).')
    .regex(/[A-Z]/, 'Doit contenir une majuscule.')
    .regex(/[0-9]/, 'Doit contenir un chiffre.'),
});

export async function restoreArchivedStaffAction(raw: unknown) {
  const parsed = RestoreSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }

  try {
    await gate();

    const snap = await getArchivedStaff(parsed.data.id);
    if (!snap) {
      return { success: false as const, error: 'Compte archivé introuvable.' };
    }
    if (snap.role === 'client') {
      return { success: false as const, error: 'Les clients ne sont pas restaurables depuis cette interface.' };
    }

    if (isMockMode()) {
      // Mode mock : réinsert dans users.json avec un nouveau mot de passe en clair
      const users = await readUsersRaw();
      if (users.some((u: any) => u.id === snap.id)) {
        return { success: false as const, error: 'Un compte actif existe déjà avec cet id.' };
      }
      const restored = {
        id: snap.id,
        email: snap.email,
        password: parsed.data.newPassword, // mock only
        full_name: snap.full_name,
        phone: snap.phone ?? '',
        role: snap.role,
        permissions: snap.permissions ?? {
          can_view_products: false, can_edit_products: false,
          can_validate_orders: false, can_follow_prospects: false,
          can_view_comptabilite: false, can_view_stocks: false,
        },
        created_at: snap.original_created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      users.push(restored);
      await writeUsersRaw(users);
      await removeArchivedStaff(snap.id);
      revalidatePath('/admin/personnels');
      return { success: true as const, restoredId: snap.id };
    }

    // Mode Supabase
    const supabase = createSupabaseServiceRoleClient();
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: snap.email,
      password: parsed.data.newPassword,
      email_confirm: true,
      user_metadata: { full_name: snap.full_name, phone: snap.phone ?? '' },
    });
    if (createErr || !created?.user) throw createErr ?? new Error('Création auth échouée.');

    const newAuthId = created.user.id;

    const { error: profileErr } = await supabase.from('users').insert({
      id: newAuthId,
      email: snap.email,
      full_name: snap.full_name,
      phone: snap.phone ?? null,
      role: snap.role,
      permissions: snap.permissions ?? {},
      created_at: snap.original_created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (profileErr) {
      await supabase.auth.admin.deleteUser(newAuthId);
      throw profileErr;
    }

    await removeArchivedStaff(snap.id);

    revalidatePath('/admin/personnels');
    return { success: true as const, restoredId: newAuthId };
  } catch (err: any) {
    return { success: false as const, error: err.message ?? 'Erreur.' };
  }
}

/** Suppression définitive d'un compte archivé (action irréversible). */
export async function purgeArchivedStaffAction(id: string) {
  try {
    await gate();
    const snap = await getArchivedStaff(id);
    if (!snap) {
      return { success: false as const, error: 'Compte archivé introuvable.' };
    }
    await removeArchivedStaff(id);
    revalidatePath('/admin/personnels');
    return { success: true as const };
  } catch (err: any) {
    return { success: false as const, error: err.message ?? 'Erreur.' };
  }
}
