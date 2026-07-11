import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServiceRoleClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { badRequest, forbidden, safeErrorResponse, unauthorized } from '@/lib/api-guard';

export const dynamic = 'force-dynamic';

const Schema = z.object({ delta: z.number().int().min(-10_000).max(10_000) });

/** PATCH : ajuste le stock. Admin uniquement. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let callerRole: 'admin' | 'client';
  try {
    const supabase = createSupabaseServerClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) return unauthorized();
    const admin = createSupabaseServiceRoleClient();
    const { data: profile } = await admin.from('users').select('role').eq('id', userRes.user.id).single();
    callerRole = (profile?.role as 'admin' | 'client') ?? 'client';
  } catch (e) {
    return safeErrorResponse(e);
  }
  if (callerRole !== 'admin') return forbidden('Droits administrateur requis.');

  const idParam = String(params.id).slice(0, 80);
  let body: unknown;
  try { body = await req.json(); } catch { return badRequest('JSON invalide.'); }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return badRequest('delta (entier) requis.');

  try {
    const supabase = createSupabaseServiceRoleClient();
    const { data: row } = await supabase.from('products').select('stock').eq('id', idParam).single();
    if (!row) return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 });
    const newStock = Math.max(0, (row.stock ?? 0) + parsed.data.delta);
    const { error } = await supabase.from('products').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', idParam);
    if (error) throw error;
    return NextResponse.json({ success: true, stock: newStock });
  } catch (e) {
    return safeErrorResponse(e);
  }
}
