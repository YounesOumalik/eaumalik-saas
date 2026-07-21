'use server';

import 'server-only';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { isMockMode } from '@/lib/api-guard';
import { requireUser } from '@/lib/supabase/server';
import {
  listLocations,
  createLocation as repoCreateLocation,
  updateLocation as repoUpdateLocation,
  archiveLocation as repoArchiveLocation,
  restoreLocation as repoRestoreLocation,
  purgeLocation as repoPurgeLocation,
  listProductLocationStock,
  getVisibleLocationsForUser,
  type LocationInput,
} from '@/data/repositories';
import type { Location, LocationType, ProductLocationStockEntry } from '@/types';

// ============================================================================
// Schémas Zod
// ============================================================================

const LocationTypeSchema = z.enum(['depot', 'magasin', 'presentoir']);

const CodeSchema = z
  .string()
  .min(3, 'Code trop court (3 caractères min).')
  .max(30, 'Code trop long.')
  .regex(/^[A-Z0-9-]+$/, 'Code en MAJUSCULES, chiffres et tirets uniquement.');

const LocationInputSchema = z.object({
  code: CodeSchema,
  name: z.string().min(2, 'Nom trop court.').max(120),
  type: LocationTypeSchema,
  address: z.string().max(255).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  capacity_units: z.coerce.number().int().min(0, 'Capacité unités ≥ 0.').optional().default(0),
  capacity_area_m2: z.coerce.number().min(0, 'Surface ≥ 0.').optional().default(0),
  is_active: z.boolean().optional().default(true),
  notes: z.string().max(2000).optional().nullable(),
});

const LocationPatchSchema = LocationInputSchema.partial();

const ListLocationsSchema = z.object({
  type: LocationTypeSchema.optional(),
  includeArchived: z.boolean().optional().default(false),
  onlyActive: z.boolean().optional().default(true),
});

const ProductStockSchema = z.object({
  productId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  onlyPositive: z.boolean().optional().default(false),
});

// ============================================================================
// Helpers : récupère l'utilisateur courant + son rôle (avec fallback mock).
// ============================================================================

async function getCurrentUserWithPermissions() {
  // En mock : on bypass l'auth (la session dev garantit déjà un admin via
  // le middleware). On retourne un superadmin fictif pour ne pas bloquer.
  if (isMockMode()) {
    return {
      id: 'mock-admin',
      email: 'mock@admin.local',
      role: 'admin',
      real_role: 'admin',
      permissions: {},
      managed_location_ids: null,
    };
  }
  const user = await requireUser();
  // Récupère managed_location_ids depuis le profil complet.
  const { createSupabaseServiceRoleClient } = await import('@/lib/supabase/server');
  const supabase = createSupabaseServiceRoleClient();
  const { data } = await supabase
    .from('users')
    .select('managed_location_ids')
    .eq('id', user.id)
    .maybeSingle();
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    real_role: user.real_role ?? user.role,
    permissions: user.permissions ?? {},
    managed_location_ids: data?.managed_location_ids ?? [],
  };
}

// ============================================================================
// listLocationsAction — accessible à tout staff authentifié, filtré par visibilité.
// ============================================================================

export async function listLocationsAction(raw: unknown): Promise<
  { success: true; locations: Location[] } | { success: false; error: string }
> {
  const parsed = ListLocationsSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  try {
    const me = await getCurrentUserWithPermissions();
    const all = await listLocations({
      type: parsed.data.type as LocationType | undefined,
      includeArchived: parsed.data.includeArchived,
      onlyActive: false,
    });
    const visible = getVisibleLocationsForUser(me, all);
    return { success: true, locations: visible };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Erreur.' };
  }
}

// ============================================================================
// listAllLocationsForAdmin — admin/administrator uniquement, sans filtre visibilité.
// ============================================================================

export async function listAllLocationsForAdminAction(raw: unknown): Promise<
  { success: true; locations: Location[] } | { success: false; error: string }
> {
  const parsed = ListLocationsSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  try {
    const me = await getCurrentUserWithPermissions();
    const realRole = me.real_role ?? me.role;
    if (!['admin', 'administrator'].includes(realRole)) {
      return { success: false, error: 'Action réservée aux administrateurs.' };
    }
    const locations = await listLocations({
      type: parsed.data.type as LocationType | undefined,
      includeArchived: parsed.data.includeArchived,
      onlyActive: parsed.data.onlyActive,
    });
    return { success: true, locations };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Erreur.' };
  }
}

// ============================================================================
// CRUD localités — admin/administrator uniquement.
// ============================================================================

export async function createLocationAction(raw: unknown): Promise<
  { success: true; location: Location } | { success: false; error: string }
> {
  const parsed = LocationInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  try {
    const me = await getCurrentUserWithPermissions();
    if (!['admin', 'administrator'].includes(me.real_role ?? me.role)) {
      return { success: false, error: 'Action réservée aux administrateurs.' };
    }
    const input: LocationInput = {
      code: parsed.data.code,
      name: parsed.data.name,
      type: parsed.data.type as LocationType,
      address: parsed.data.address ?? null,
      city: parsed.data.city ?? null,
      phone: parsed.data.phone ?? null,
      capacity_units: parsed.data.capacity_units,
      capacity_area_m2: parsed.data.capacity_area_m2,
      is_active: parsed.data.is_active,
      notes: parsed.data.notes ?? null,
    };
    const location = await repoCreateLocation(input);
    revalidatePath('/admin/locations');
    revalidatePath('/admin/stocks');
    return { success: true, location };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Erreur.' };
  }
}

export async function updateLocationAction(id: string, raw: unknown): Promise<
  { success: true; location: Location } | { success: false; error: string }
> {
  const parsed = LocationPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  try {
    const me = await getCurrentUserWithPermissions();
    if (!['admin', 'administrator'].includes(me.real_role ?? me.role)) {
      return { success: false, error: 'Action réservée aux administrateurs.' };
    }
    const location = await repoUpdateLocation(id, parsed.data as Partial<LocationInput>);
    revalidatePath('/admin/locations');
    revalidatePath('/admin/stocks');
    return { success: true, location };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Erreur.' };
  }
}

export async function archiveLocationAction(id: string): Promise<
  { success: true; location: Location } | { success: false; error: string }
> {
  try {
    const me = await getCurrentUserWithPermissions();
    if (!['admin', 'administrator'].includes(me.real_role ?? me.role)) {
      return { success: false, error: 'Action réservée aux administrateurs.' };
    }
    const location = await repoArchiveLocation(id);
    revalidatePath('/admin/locations');
    return { success: true, location };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Erreur.' };
  }
}

export async function restoreLocationAction(id: string): Promise<
  { success: true; location: Location } | { success: false; error: string }
> {
  try {
    const me = await getCurrentUserWithPermissions();
    if (!['admin', 'administrator'].includes(me.real_role ?? me.role)) {
      return { success: false, error: 'Action réservée aux administrateurs.' };
    }
    const location = await repoRestoreLocation(id);
    revalidatePath('/admin/locations');
    return { success: true, location };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Erreur.' };
  }
}

export async function purgeLocationAction(id: string): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    const me = await getCurrentUserWithPermissions();
    if (me.real_role !== 'admin') {
      return { success: false, error: 'Action réservée au superadministrateur.' };
    }
    await repoPurgeLocation(id);
    revalidatePath('/admin/locations');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Erreur.' };
  }
}

// ============================================================================
// Stock par localité (lecture)
// ============================================================================

export async function listProductLocationStockAction(raw: unknown): Promise<
  { success: true; entries: ProductLocationStockEntry[] } | { success: false; error: string }
> {
  const parsed = ProductStockSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  try {
    await getCurrentUserWithPermissions();
    const entries = await listProductLocationStock({
      productId: parsed.data.productId,
      locationId: parsed.data.locationId,
      onlyPositive: parsed.data.onlyPositive,
    });
    return { success: true, entries };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Erreur.' };
  }
}