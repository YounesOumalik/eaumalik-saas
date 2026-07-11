import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { badRequest, safeErrorResponse, sanitizePostgREST } from '@/lib/api-guard';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  category: z.string().max(40).optional(),
  search: z.string().max(100).optional(),
  featured: z.string().optional(),
});

/** GET : lecture publique du catalogue (politique RLS "Produits lisibles par tous"). */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = Schema.safeParse({
      category: searchParams.get('category') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      featured: searchParams.get('featured') ?? undefined,
    });
    if (!parsed.success) return badRequest('Paramètres invalides.');
    const { category, search, featured } = parsed.data;
    const isFeatured = featured === 'true';

    const supabase = createSupabaseServerClient();
    let query = supabase.from('products').select('*').order('created_at', { ascending: false });
    query = query.or('is_archived.is.null,is_archived.eq.false');
    if (category && category !== 'all' && /^[a-z\-]+$/.test(category)) query = query.eq('category', category);
    if (isFeatured) query = query.eq('is_featured', true);
    // Utilisation de textSearch au lieu de interpolation : échappement natif PostgREST.
    if (search && search.trim().length > 0) {
      const safe = sanitizePostgREST(search);
      if (safe.length > 0) query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    return safeErrorResponse(e);
  }
}
