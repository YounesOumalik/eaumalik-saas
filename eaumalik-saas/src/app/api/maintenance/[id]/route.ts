import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServiceRoleClient, createSupabaseServerClient } from '@/lib/supabase/server';
import { badRequest, forbidden, safeErrorResponse, unauthorized } from '@/lib/api-guard';

export const dynamic = 'force-dynamic';

const MaintenanceStatus = z.enum(['a_jour', 'a_renouveler', 'expire', 'rappel_envoye', 'commande_creee']);

/** PATCH : met à jour le statut d'une alerte de maintenance. Admin uniquement. */
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
  const parsed = MaintenanceStatus.safeParse((body as any)?.status);
  if (!parsed.success) return badRequest('Statut invalide.');

  try {
    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase
      .from('maintenance_alerts')
      .update({ status: parsed.data, updated_at: new Date().toISOString() })
      .eq('id', idParam);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    return safeErrorResponse(e);
  }
}
