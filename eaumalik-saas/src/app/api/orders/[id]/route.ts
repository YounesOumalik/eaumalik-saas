import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServiceRoleClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { badRequest, forbidden, isMockMode, safeErrorResponse, unauthorized } from '@/lib/api-guard';
import { ensureMaintenanceForOrder, listMaintenanceRecords, updateOrderStatus } from '@/data/repositories';
import { readOrders, writeOrders } from '@/data/localDb';

export const dynamic = 'force-dynamic';

const OrderStatusSchema = z.enum(['en_attente', 'traitee', 'en_livraison', 'livree', 'annulee']);

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
    const parsed = OrderStatusSchema.safeParse((body as any)?.status);
    if (!parsed.success) return badRequest('Statut invalide.');

    const newStatus = parsed.data;
    const now = new Date().toISOString();
    const list = readOrders();
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
    writeOrders(list);

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

  const parsed = OrderStatusSchema.safeParse((body as any)?.status);
  if (!parsed.success) return badRequest('Statut invalide.');

  const newStatus = parsed.data;
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
    });
  } catch (e) {
    return safeErrorResponse(e);
  }
}
