import { NextRequest, NextResponse } from 'next/server';
import { listMaintenanceRecordsForUser } from '@/data/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isMockMode, safeErrorResponse, unauthorized } from '@/lib/api-guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/maintenance/mine
 * Renvoie les fiches de maintenance visibles par le CLIENT authentifié.
 * Filtre strict : user_id = session.user.id OU order_id ∈ commandes du client.
 *
 * Endpoint read-only utilisé pour rafraîchir l'onglet Maintenance côté client
 * sans recharger toute la page (polling manuel / après ajout d'intervention
 * par un admin).
 */
export async function GET(_req: NextRequest) {
  try {
    // Mode mock : la session est portée par le cookie `eaumalik_dev_session`.
    if (isMockMode()) {
      const { getDevUserFromCookie } = await import('@/lib/auth/devSession');
      const dev = await getDevUserFromCookie();
      if (!dev) return unauthorized();
      const records = await listMaintenanceRecordsForUser(dev.id);
      return NextResponse.json({ records });
    }

    const supabase = createSupabaseServerClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) return unauthorized();
    const records = await listMaintenanceRecordsForUser(userRes.user.id);
    return NextResponse.json({ records });
  } catch (e) {
    return safeErrorResponse(e);
  }
}