'use server';

import 'server-only';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { isMockMode } from '@/lib/api-guard';
import {
  createTransferRequest as repoCreate,
  updateTransferRequestStatus as repoUpdateStatus,
  executeTransferRequest as repoExecute,
  listTransferRequests,
  listProductLocationStock,
  getVisibleLocationsForUser,
  type TransferRequestRow,
} from '@/data/repositories';

// ============================================================================
// Schémas Zod
// ============================================================================

const CreateTransferRequestSchema = z.object({
  product_id: z.string().uuid('Produit invalide.'),
  source_location_id: z.string().uuid('Localité source invalide.'),
  destination_location_id: z.string().uuid('Localité destination invalide.'),
  quantity: z.coerce.number().int().positive('Quantité > 0.'),
  request_type: z.enum(['outbound', 'inbound']).optional().default('outbound'),
  reason: z.string().max(500).optional(),
});

const UpdateStatusSchema = z.object({
  request_id: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'execute', 'cancel']),
  comment: z.string().max(500).optional(),
});

const ListTransfersSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'executed', 'cancelled']).optional(),
  productId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  myRequestsOnly: z.boolean().optional().default(false),
});

// ============================================================================
// Helpers : récupère l'utilisateur courant (mock-friendly).
// ============================================================================

async function getCurrentUser() {
  if (isMockMode()) {
    return { id: 'mock-admin', email: 'mock@admin.local', role: 'admin', real_role: 'admin', managed_location_ids: null };
  }
  const { requireUser, createSupabaseServiceRoleClient } = await import('@/lib/supabase/server');
  const user = await requireUser();
  const supabase = createSupabaseServiceRoleClient();
  const { data } = await supabase.from('users').select('managed_location_ids').eq('id', user.id).maybeSingle();
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    real_role: user.real_role ?? user.role,
    managed_location_ids: data?.managed_location_ids ?? [],
  };
}

/** Vérifie que l'utilisateur peut agir (créer/exécuter) sur cette localité. */
function userCanActOnLocation(
  user: { real_role?: string; managed_location_ids?: string[] | null },
  locationId: string,
): boolean {
  const role = user.real_role ?? '';
  if (['admin', 'administrator', 'sales', 'stock_manager', 'admin_assistant'].includes(role)) {
    return true;
  }
  // Pour les sous-rôles logistiques : on ne vérifie que l'appartenance
  // à managed_location_ids (la séparation par type est faite au niveau
  // de getVisibleLocationsForUser côté UI).
  return (user.managed_location_ids ?? []).map(String).includes(locationId);
}

// ============================================================================
// createTransferRequestAction — staff authentifié ayant accès à la destination.
// Si la source n'est PAS dans les affectations → la demande passe en workflow
// (pending → approve par admin/administrator → execute).
// ============================================================================

export async function createTransferRequestAction(raw: unknown): Promise<
  { success: true; request: TransferRequestRow } | { success: false; error: string }
> {
  const parsed = CreateTransferRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  if (parsed.data.source_location_id === parsed.data.destination_location_id) {
    return { success: false, error: 'La localité source et destination doivent être différentes.' };
  }
  try {
    const me = await getCurrentUser();
    if (!userCanActOnLocation(me, parsed.data.destination_location_id)) {
      return { success: false, error: 'Vous n\'avez pas accès à cette localité destination.' };
    }
    // Vérifier que le stock source est suffisant.
    const stockEntries = await listProductLocationStock({
      productId: parsed.data.product_id,
      locationId: parsed.data.source_location_id,
    });
    const sourceQty = stockEntries[0]?.quantity ?? 0;
    if (sourceQty < parsed.data.quantity) {
      return {
        success: false,
        error: `Stock insuffisant en source (disponible : ${sourceQty}, demandé : ${parsed.data.quantity}).`,
      };
    }
    const request = await repoCreate({
      product_id: parsed.data.product_id,
      source_location_id: parsed.data.source_location_id,
      destination_location_id: parsed.data.destination_location_id,
      quantity: parsed.data.quantity,
      request_type: parsed.data.request_type,
      requester_id: me.id,
      reason: parsed.data.reason,
    });
    revalidatePath('/admin/locations');
    return { success: true, request };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Erreur.' };
  }
}

// ============================================================================
// updateTransferRequestAction — approve (admin OU administrator) / reject /
// execute / cancel (requester sur pending/approved).
// ============================================================================

export async function updateTransferRequestAction(raw: unknown): Promise<
  { success: true; request: TransferRequestRow } | { success: false; error: string }
> {
  const parsed = UpdateStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  try {
    const me = await getCurrentUser();
    const myRole = me.real_role ?? me.role;

    const rows = await listTransferRequests();
    const tr = rows.find((r) => r.id === parsed.data.request_id);
    if (!tr) return { success: false, error: 'Demande introuvable.' };

    if (parsed.data.action === 'approve') {
      if (!['admin', 'administrator'].includes(myRole)) {
        return { success: false, error: 'Approbation réservée aux administrateurs.' };
      }
      if (tr.status !== 'pending') {
        return { success: false, error: `Impossible d'approuver une demande en statut ${tr.status}.` };
      }
      const updated = await repoUpdateStatus(tr.id, {
        status: 'approved',
        validator_id: me.id ?? undefined,
        validator_comment: parsed.data.comment ?? undefined,
      });
      revalidatePath('/admin/locations');
      return { success: true, request: updated };
    }

    if (parsed.data.action === 'reject') {
      if (!['admin', 'administrator'].includes(myRole)) {
        return { success: false, error: 'Rejet réservé aux administrateurs.' };
      }
      if (tr.status !== 'pending') {
        return { success: false, error: `Impossible de rejeter une demande en statut ${tr.status}.` };
      }
      if (!parsed.data.comment || parsed.data.comment.trim().length < 3) {
        return { success: false, error: 'Un commentaire est obligatoire pour rejeter (min. 3 caractères).' };
      }
      const updated = await repoUpdateStatus(tr.id, {
        status: 'rejected',
        validator_id: me.id ?? undefined,
        validator_comment: parsed.data.comment,
      });
      revalidatePath('/admin/locations');
      return { success: true, request: updated };
    }

    if (parsed.data.action === 'execute') {
      if (tr.status !== 'approved') {
        return { success: false, error: `Seule une demande approuvée peut être exécutée (actuellement : ${tr.status}).` };
      }
      // Exécution : admin OU administrator OU le requester.
      if (
        !['admin', 'administrator'].includes(myRole) &&
        tr.requester_id !== me.id
      ) {
        return { success: false, error: 'Vous n\'êtes pas autorisé à exécuter cette demande.' };
      }
      const result = await repoExecute(tr.id);
      if (!result.ok) {
        return { success: false, error: result.error ?? 'Échec de l\'exécution.' };
      }
      const updated = await listTransferRequests().then((rs) => rs.find((r) => r.id === tr.id));
      revalidatePath('/admin/locations');
      revalidatePath('/admin/stocks');
      revalidatePath('/admin/catalogue');
      revalidatePath('/boutique');
      return { success: true, request: updated ?? tr };
    }

    if (parsed.data.action === 'cancel') {
      if (tr.requester_id !== me.id && !['admin', 'administrator'].includes(myRole)) {
        return { success: false, error: 'Seul le demandeur peut annuler sa demande.' };
      }
      if (!['pending', 'approved'].includes(tr.status)) {
        return { success: false, error: `Impossible d'annuler une demande en statut ${tr.status}.` };
      }
      const updated = await repoUpdateStatus(tr.id, {
        status: 'cancelled',
        validator_id: me.id ?? undefined,
        validator_comment: parsed.data.comment ?? 'Annulée par ' + (myRole === 'admin' ? 'superadmin' : myRole),
      });
      revalidatePath('/admin/locations');
      return { success: true, request: updated };
    }

    return { success: false, error: 'Action inconnue.' };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Erreur.' };
  }
}

// ============================================================================
// listTransferRequestsAction — staff authentifié, filtré par visibilité.
// ============================================================================

export async function listTransferRequestsAction(raw: unknown): Promise<
  { success: true; requests: TransferRequestRow[] } | { success: false; error: string }
> {
  const parsed = ListTransfersSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Validation échouée.' };
  }
  try {
    const me = await getCurrentUser();
    const rows = await listTransferRequests({
      status: parsed.data.status as TransferRequestRow['status'] | undefined,
      productId: parsed.data.productId,
      locationId: parsed.data.locationId,
      requesterId: parsed.data.myRequestsOnly ? me.id : undefined,
    });
    // Filtre final : un sous-rôle logistique ne voit QUE les demandes qui
    // impliquent une de ses localités affectées.
    const realRole = me.real_role ?? me.role;
    if (['admin', 'administrator', 'sales', 'stock_manager', 'admin_assistant'].includes(realRole)) {
      return { success: true, requests: rows };
    }
    const managed = (me.managed_location_ids ?? []).map(String);
    const filtered = rows.filter(
      (r) => managed.includes(r.source_location_id) || managed.includes(r.destination_location_id),
    );
    return { success: true, requests: filtered };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Erreur.' };
  }
}

// ============================================================================
// executeTransferRequestAction — endpoint public (utilisé par le bouton
// « Exécuter maintenant » sur une demande approved).
// ============================================================================

export async function executeTransferRequestAction(requestId: string): Promise<
  { success: true; request: TransferRequestRow } | { success: false; error: string }
> {
  try {
    const me = await getCurrentUser();
    const myRole = me.real_role ?? me.role;
    const rows = await listTransferRequests();
    const tr = rows.find((r) => r.id === requestId);
    if (!tr) return { success: false, error: 'Demande introuvable.' };
    if (tr.status !== 'approved') {
      return { success: false, error: `Demande non approuvée (${tr.status}).` };
    }
    if (!['admin', 'administrator'].includes(myRole) && tr.requester_id !== me.id) {
      return { success: false, error: 'Vous n\'êtes pas autorisé à exécuter cette demande.' };
    }
    const result = await repoExecute(requestId);
    if (!result.ok) return { success: false, error: result.error ?? 'Échec.' };
    const updated = await listTransferRequests().then((rs) => rs.find((r) => r.id === requestId));
    revalidatePath('/admin/locations');
    revalidatePath('/admin/stocks');
    revalidatePath('/admin/catalogue');
    revalidatePath('/boutique');
    return { success: true, request: updated ?? tr };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Erreur.' };
  }
}

// Réexport du helper de visibilité pour les composants clients (lecture).
export { getVisibleLocationsForUser };