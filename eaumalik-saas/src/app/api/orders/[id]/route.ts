import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServiceRoleClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { badRequest, forbidden, safeErrorResponse, unauthorized } from '@/lib/api-guard';

export const dynamic = 'force-dynamic';

const OrderStatusSchema = z.enum(['en_attente', 'traitee', 'en_livraison', 'livree', 'annulee']);

/** PATCH — admin uniquement (changement de statut d'une commande). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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

  try {
    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase
      .from('orders')
      .update({ status: parsed.data, updated_at: new Date().toISOString() })
      .eq('id', idParam);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    return safeErrorResponse(e);
  }
}
