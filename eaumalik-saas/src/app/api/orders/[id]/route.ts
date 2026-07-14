import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServiceRoleClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { badRequest, forbidden, isMockMode, safeErrorResponse, unauthorized } from '@/lib/api-guard';
import { ensureMaintenanceForOrder, listMaintenanceRecords, updateOrderStatus } from '@/data/repositories';
import { readOrdersRaw, writeOrdersRaw } from '@/data/repositories';

export const dynamic = 'force-dynamic';

const OrderStatusSchema = z.enum(['en_attente', 'traitee', 'en_livraison', 'livree', 'annulee']);

/**
 * Schéma du profil d'agent accompagnant une annulation (optionnel mais
 * journalisé dans `notes` quand fourni).
 */
const CancelledBySchema = z.object({
  id: z.string().min(1).max(120),
  email: z.string().email().max(200),
  full_name: z.string().min(1).max(200),
  role: z.string().min(1).max(60),
}).optional();

const PatchBodySchema = z.object({
  status: OrderStatusSchema,
  reason: z.string().max(500).optional(),
  cancelled_by: CancelledBySchema,
});

/** Construit la ligne de commentaire d'annulation (profil agent + date + motif). */
function buildCancellationComment(agent: { full_name: string; email: string; role: string } | undefined, reason: string | undefined, when: string): string {
  const dateStr = new Date(when).toISOString().slice(0, 19).replace('T', ' ');
  const agentLine = agent
    ? `Agent : ${agent.full_name} <${agent.email}> (${agent.role})`
    : 'Agent : (inconnu — non authentifié)';
  const motifLine = reason && reason.trim().length > 0
    ? `Motif : ${reason.trim()}`
    : 'Motif : (non renseigné)';
  return `[Annulation — ${dateStr}]\n${agentLine}\n${motifLine}`;
}

/** PATCH — admin uniquement (changement de statut d'une commande).
 *  Met automatiquement à jour :
 *    - processed_at / shipped_at / delivered_at selon le nouveau statut
 *    - tracking_number (synchronisé avec order_number si manquant)
 *    - estimated_delivery (par défaut +2 jours quand passage en "en_livraison")
 *  Effet de bord : si passage en 'livree', crée les programmes de maintenance
 *  correspondants (1 par produit de la commande) — idempotent grâce au trigger SQL.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  // Mode mock : pas d'auth (dev local sans Supabase)
  if (isMockMode()) {
    const idParam = String(params.id).slice(0, 80);
    let body: unknown;
    try { body = await req.json(); } catch { return badRequest('JSON invalide.'); }
    const parsed = PatchBodySchema.safeParse(body);
    if (!parsed.success) return badRequest('Corps invalide.');
    const { status: newStatus, reason, cancelled_by } = parsed.data;
    const now = new Date().toISOString();
    const list = await readOrdersRaw();
    const order = list.find(o => o.id === idParam);
    if (!order) return badRequest('Commande introuvable.');

    order.status = newStatus;
    order.updated_at = now;
    order.tracking_number = order.tracking_number || order.order_number;
    order.carrier = order.carrier || 'EAUMALIK Express';
    if (newStatus === 'traitee') order.processed_at = now;
    if (newStatus === 'en_livraison') {
      order.shipped_at = now;
      if (!order.estimated_delivery) {
        const eta = new Date();
        eta.setDate(eta.getDate() + 2);
        order.estimated_delivery = eta.toISOString();
      }
    }
    if (newStatus === 'livree') order.delivered_at = now;
    // Annulation : on consigne le profil de l'agent + date + motif dans `notes`.
    if (newStatus === 'annulee') {
      const comment = buildCancellationComment(cancelled_by, reason, now);
      order.notes = order.notes && order.notes.trim().length > 0
        ? `${order.notes}\n\n---\n${comment}`
        : comment;
    }
    await writeOrdersRaw(list);

    let maintenanceRecords: any[] = [];
    if (newStatus === 'livree') {
      const existing = await listMaintenanceRecords({ orderId: idParam });
      if (existing.length === 0) {
        maintenanceRecords = await ensureMaintenanceForOrder({ ...order, items: order.items });
      } else {
        maintenanceRecords = existing;
      }
    }
    return NextResponse.json({
      success: true,
      order_id: idParam,
      status: newStatus,
      maintenance_created: maintenanceRecords.length,
      comment_recorded: newStatus === 'annulee',
    });
  }

  let caller: { id: string; role: 'admin' | 'client' };
  try {
    const supabase = createSupabaseServerClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) return unauthorized();
    caller = { id: userRes.user.id, role: 'client' };
    const admin = createSupabaseServiceRoleClient();
    const { data: profile } = await admin.from('users').select('role').eq('id', userRes.user.id).single();
    if (profile?.role === 'admin') caller.role = 'admin';
  } catch (e) {
    return safeErrorResponse(e);
  }

  if (caller.role !== 'admin') return forbidden('Droits administrateur requis.');

  const idParam = String(params.id).slice(0, 80);
  let body: unknown;
  try { body = await req.json(); } catch { return badRequest('JSON invalide.'); }

  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) return badRequest('Corps invalide.');
  const { status: newStatus, reason, cancelled_by } = parsed.data;
  const now = new Date().toISOString();

  try {
    const admin = createSupabaseServiceRoleClient();

    // 1) Récupérer la commande pour connaître son order_number + items
    const { data: order, error: getErr } = await admin
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('id', idParam)
      .single();
    if (getErr || !order) throw getErr ?? new Error('Commande introuvable');

    // 2) Construire le patch de tracking
    const trackingPatch: Record<string, any> = {
      status: newStatus,
      updated_at: now,
      tracking_number: order.tracking_number || order.order_number,
      carrier: order.carrier || 'EAUMALIK Express',
    };
    if (newStatus === 'traitee') {
      trackingPatch.processed_at = now;
    }
    if (newStatus === 'en_livraison') {
      trackingPatch.shipped_at = now;
      if (!order.estimated_delivery) {
        const eta = new Date();
        eta.setDate(eta.getDate() + 2);
        trackingPatch.estimated_delivery = eta.toISOString();
      }
    }
    if (newStatus === 'livree') {
      trackingPatch.delivered_at = now;
    }

    // Annulation : on consigne le profil de l'agent + date + motif dans `notes`
    // (champ libre déjà utilisé pour les notes admin — on appende au contenu
    // existant pour préserver l'historique).
    if (newStatus === 'annulee') {
      const comment = buildCancellationComment(cancelled_by, reason, now);
      const existing = typeof order.notes === 'string' ? order.notes.trim() : '';
      trackingPatch.notes = existing.length > 0 ? `${existing}\n\n---\n${comment}` : comment;
    }

    const { error: updErr } = await admin
      .from('orders')
      .update(trackingPatch)
      .eq('id', idParam);
    if (updErr) throw updErr;

    // 3) Effet de bord : si "livree", on s'assure que la maintenance existe.
    //    En prod : trigger SQL `ensure_maintenance_on_delivery` (idempotent).
    //    En mock : on appelle aussi explicitement le repository pour la même raison.
    let maintenanceRecords: any[] = [];
    if (newStatus === 'livree') {
      maintenanceRecords = await listMaintenanceRecords({ orderId: idParam });
      if (maintenanceRecords.length === 0) {
        maintenanceRecords = await ensureMaintenanceForOrder({ ...order, status: newStatus, ...trackingPatch });
      }
    }

    return NextResponse.json({
      success: true,
      order_id: idParam,
      status: newStatus,
      maintenance_created: maintenanceRecords.length,
      comment_recorded: newStatus === 'annulee',
    });
  } catch (e) {
    return safeErrorResponse(e);
  }
}
