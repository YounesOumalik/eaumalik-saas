import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  listMaintenanceRecords,
  ensureMaintenanceForOrder,
  readOrdersRaw,
} from '@/data/repositories';
import { createSupabaseServiceRoleClient, createSupabaseServerClient } from '@/lib/supabase/server';
import {
  badRequest,
  forbidden,
  isMockMode,
  safeErrorResponse,
  unauthorized,
} from '@/lib/api-guard';

export const dynamic = 'force-dynamic';

const maintenanceStatusSchema = z.enum(['actif', 'a_renouveler', 'suspendu', 'resilie']);

const createForOrderSchema = z.object({
  order_id: z.string().min(1).max(80),
});

/**
 * GET /api/maintenance
 * Query : ?status=actif&order_id=...&search=...&due_before=YYYY-MM-DD
 * Retourne toutes les fiches de maintenance (admin uniquement).
 */
export async function GET(req: NextRequest) {
  try {
    // Mode mock : pas d'auth (dev local sans Supabase)
    if (isMockMode()) {
      const url = new URL(req.url);
      const status = url.searchParams.get('status') ?? undefined;
      const orderId = url.searchParams.get('order_id') ?? undefined;
      const search = url.searchParams.get('search') ?? undefined;
      const dueBefore = url.searchParams.get('due_before') ?? undefined;
      const validatedStatus = status ? maintenanceStatusSchema.safeParse(status) : undefined;
      if (validatedStatus && !validatedStatus.success) {
        return badRequest('Statut de maintenance invalide.');
      }
      const records = await listMaintenanceRecords({
        status: (validatedStatus?.data ?? undefined) as any,
        orderId: orderId ?? undefined,
        search: search ?? undefined,
        dueBefore: dueBefore ?? undefined,
      });
      return NextResponse.json({ records });
    }

    const supabase = createSupabaseServerClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) return unauthorized();

    const admin = createSupabaseServiceRoleClient();
    const { data: profile } = await admin
      .from('users')
      .select('role')
      .eq('id', userRes.user.id)
      .single();
    if (profile?.role !== 'admin') return forbidden('Droits administrateur requis.');

    const url = new URL(req.url);
    const status = url.searchParams.get('status') ?? undefined;
    const orderId = url.searchParams.get('order_id') ?? undefined;
    const search = url.searchParams.get('search') ?? undefined;
    const dueBefore = url.searchParams.get('due_before') ?? undefined;

    const validatedStatus = status
      ? maintenanceStatusSchema.safeParse(status)
      : undefined;
    if (validatedStatus && !validatedStatus.success) {
      return badRequest('Statut de maintenance invalide.');
    }

    const records = await listMaintenanceRecords({
      status: (validatedStatus?.data ?? undefined) as any,
      orderId: orderId ?? undefined,
      search: search ?? undefined,
      dueBefore: dueBefore ?? undefined,
    });
    return NextResponse.json({ records });
  } catch (e) {
    return safeErrorResponse(e);
  }
}

/**
 * POST /api/maintenance  { order_id }
 * Force la création d'un programme de maintenance à partir d'une commande livrée.
 * (Le trigger SQL le fait déjà automatiquement. Cette route est un fallback manuel.)
 */
export async function POST(req: NextRequest) {
  try {
    // Mode mock : pas d'auth
    if (isMockMode()) {
      let body: unknown;
      try { body = await req.json(); } catch { return badRequest('JSON invalide.'); }
      const parsed = createForOrderSchema.safeParse(body);
      if (!parsed.success) return badRequest('order_id requis.');
      const order = (await readOrdersRaw()).find(o => o.id === parsed.data.order_id);
      if (!order) return badRequest('Commande introuvable.');
      if (order.status !== 'livree') return badRequest('La maintenance est disponible uniquement après livraison.');
      const records = await ensureMaintenanceForOrder(order as any);
      return NextResponse.json({ success: true, records });
    }

    const supabase = createSupabaseServerClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) return unauthorized();

    const admin = createSupabaseServiceRoleClient();
    const { data: profile } = await admin
      .from('users')
      .select('role')
      .eq('id', userRes.user.id)
      .single();
    if (profile?.role !== 'admin' && profile?.role !== 'administrator') return forbidden('Droits administrateur requis.');

    let body: unknown;
    try { body = await req.json(); } catch { return badRequest('JSON invalide.'); }
    const parsed = createForOrderSchema.safeParse(body);
    if (!parsed.success) return badRequest('order_id requis.');

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('*')
      .eq('id', parsed.data.order_id)
      .single();
    if (orderErr || !order) return badRequest('Commande introuvable.');
    if (order.status !== 'livree') return badRequest('La maintenance est disponible uniquement après livraison.');

    const records = await ensureMaintenanceForOrder(order as any);
    return NextResponse.json({ success: true, records });
  } catch (e) {
    return safeErrorResponse(e);
  }
}
