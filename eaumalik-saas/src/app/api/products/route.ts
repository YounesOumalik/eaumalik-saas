import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { badRequest, safeErrorResponse, sanitizePostgREST, isMockMode } from '@/lib/api-guard';
import { listProducts } from '@/data/repositories';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  category: z.string().max(40).optional(),
  search: z.string().max(100).optional(),
  featured: z.string().optional(),
  /** Liste d'IDs séparés par des virgules pour filtrer (utile pour les promos). */
  ids: z.string().max(500).optional(),
});

/** GET : lecture publique du catalogue (politique RLS "Produits lisibles par tous").
 *  Supporte le mode mock (data-store/products.json) en plus du mode Supabase. */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = Schema.safeParse({
      category: searchParams.get('category') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      featured: searchParams.get('featured') ?? undefined,
      ids: searchParams.get('ids') ?? undefined,
    });
    if (!parsed.success) return badRequest('Paramètres invalides.');
    const { category, search, featured, ids } = parsed.data;
    const isFeatured = featured === 'true';

    // Validation du filtre `ids` : liste d'IDs séparés par des virgules, max 50 ids.
    const idList = ids
      ? Array.from(
          new Set(
            ids
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s.length > 0 && s.length <= 80 && /^[a-zA-Z0-9_\-]+$/.test(s)),
          ),
        ).slice(0, 50)
      : [];

    // ----- MODE MOCK : on lit depuis le JSON FS via le repository. -----
    // Permet aux composants client (BoutiquePromotions, etc.) de résoudre
    // les `product_ids` des promotions même sans Supabase configuré.
    if (isMockMode()) {
      let products = await listProducts();
      if (idList.length > 0) products = products.filter((p) => idList.includes(p.id));
      if (category && category !== 'all') products = products.filter((p) => p.category === category);
      if (isFeatured) products = products.filter((p) => p.is_featured);
      if (search && search.trim().length > 0) {
        const q = search.toLowerCase();
        products = products.filter(
          (p) => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q),
        );
      }
      return NextResponse.json(products);
    }

    // ----- MODE SUPABASE -----
    const supabase = createSupabaseServerClient();
    let query = supabase.from('products').select('*').order('created_at', { ascending: false });
    query = query.or('is_archived.is.null,is_archived.eq.false');
    if (idList.length > 0) query = query.in('id', idList);
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