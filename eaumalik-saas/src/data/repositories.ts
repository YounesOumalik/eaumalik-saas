// Repository layer — abstraction Supabase ↔ Mocks.
// Bascule automatiquement en fonction de NEXT_PUBLIC_USE_MOCKS et de la présence des credentials.
import 'server-only';
import type {
  Product,
  Order,
  OrderItem,
  User,
  MaintenanceAlert,
  CompanyProfile,
  News,
  MaintenanceRecord,
  MaintenanceIntervention,
  InterventionType,
  MaintenanceProgramStatus,
  ProductRestock,
  StockMovementReason,
} from '@/types';
import {
  MOCK_PRODUCTS,
  MOCK_USERS,
  MOCK_ORDERS,
  MOCK_ORDER_ITEMS,
  MOCK_MAINTENANCE,
  MOCK_COMPANY,
} from '@/data/mock';
import {
  readProducts,
  writeProducts,
  readOrders,
  writeOrders,
  readUsers,
  writeUsers,
  readArchivedUsers,
  writeArchivedUsers,
  readRestockHistory,
  writeRestockHistory,
  readNews,
  writeNews,
  readMessages,
  writeMessages,
  readMaintenance,
  writeMaintenance,
  readPasswordResets,
  writePasswordResets,
  readCarts,
  writeCarts,
} from '@/data/localDb';
import { sanitizePostgREST } from '@/lib/api-guard';
import type { PublicMediaKind } from '@/lib/public-media';

const shouldUseMocks = (): boolean => {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') return true;
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
};

// Lazy import de @supabase/server pour éviter d'instancier côté client.
async function getSupabase() {
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  return createSupabaseServerClient();
}

let publicClientPromise: Promise<any> | null = null;

/**
 * Client anonyme pour les données réellement publiques. Contrairement au
 * client RSC authentifié, il ne lit pas `cookies()` : l'accueil et la boutique
 * peuvent donc être mis en cache/ISR sans devenir dynamiques par accident.
 */
async function getPublicSupabase() {
  if (!publicClientPromise) {
    publicClientPromise = (async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error('Configuration Supabase publique manquante.');
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
    })();
  }
  return publicClientPromise;
}

// ============================================================================
// PRODUCTS
// ============================================================================
export async function listProducts(filters?: {
  category?: string;
  search?: string;
  featured?: boolean;
  includeArchived?: boolean;
}): Promise<Product[]> {
  if (shouldUseMocks()) {
    let list = readProducts();
    if (!filters?.includeArchived) {
      list = list.filter((p) => !p.is_archived);
    }
    if (filters?.category && filters.category !== 'all')
      list = list.filter((p) => p.category === filters.category);
    if (filters?.featured) list = list.filter((p) => p.is_featured);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q),
      );
    }
    // Tri manuel : sort_order ASC puis created_at DESC pour les égalités.
    return list.slice().sort((a, b) => {
      const sa = a.sort_order ?? 0;
      const sb = b.sort_order ?? 0;
      if (sa !== sb) return sa - sb;
      return (b.created_at ?? '').localeCompare(a.created_at ?? '');
    });
  }

  const supabase = await getPublicSupabase();
  // Tri par ordre manuel (sort_order ASC), puis plus récent en premier.
  let query = supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (!filters?.includeArchived) {
    query = query.or('is_archived.is.null,is_archived.eq.false');
  }
  if (filters?.category && filters.category !== 'all')
    query = query.eq('category', filters.category);
  if (filters?.featured) query = query.eq('is_featured', true);
  if (filters?.search) {
    const safe = sanitizePostgREST(filters.search);
    if (safe.length > 0) {
      query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Product[];
}

/**
 * Projection minimale utilisée par le checkout.
 * Elle évite de transférer les images Base64 et garantit que le prix et le
 * stock sont relus côté serveur avant toute création de commande.
 */
export async function getProductsForOrder(productIds: string[]): Promise<
  Array<Pick<Product, 'id' | 'name' | 'price' | 'stock' | 'price_on_request' | 'is_archived'>>
> {
  const ids = Array.from(new Set(productIds));
  if (ids.length === 0) return [];
  if (shouldUseMocks()) {
    return readProducts()
      .filter((product) => ids.includes(product.id))
      .map(({ id, name, price, stock, price_on_request, is_archived }) => ({
        id,
        name,
        price,
        stock,
        price_on_request,
        is_archived,
      }));
  }

  const supabase = await getPublicSupabase();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, price, stock, price_on_request, is_archived')
    .in('id', ids);
  if (error) throw error;
  return (data ?? []) as Array<Pick<Product, 'id' | 'name' | 'price' | 'stock' | 'price_on_request' | 'is_archived'>>;
}

/**
 * Lit uniquement une image Base64 destinée à une route média publique.
 * Les actualités ciblées ou archivées ne sont jamais exposées anonymement.
 */
export async function getPublicInlineImageSource(
  kind: PublicMediaKind,
  id: string,
): Promise<string | null> {
  if (shouldUseMocks()) {
    const row =
      kind === 'product'
        ? readProducts().find((product) => product.id === id && !product.is_archived)
        : readNews().find(
            (news) =>
              news.id === id &&
              news.target_all !== false &&
              news.is_archived !== true &&
              (!news.valid_until || news.valid_until > new Date().toISOString()),
          );
    return typeof row?.image_url === 'string' ? row.image_url : null;
  }

  const supabase = await getPublicSupabase();
  if (kind === 'product') {
    const { data, error } = await supabase
      .from('products')
      .select('image_url, is_archived')
      .eq('id', id)
      .maybeSingle();
    if (error || !data || data.is_archived === true) return null;
    return typeof data.image_url === 'string' ? data.image_url : null;
  }

  const { data, error } = await supabase
    .from('news')
    .select('image_url, target_all, is_archived, valid_until')
    .eq('id', id)
    .maybeSingle();
  if (
    error ||
    !data ||
    data.target_all === false ||
    data.is_archived === true ||
    (data.valid_until && data.valid_until <= new Date().toISOString())
  ) {
    return null;
  }
  return typeof data.image_url === 'string' ? data.image_url : null;
}

export async function createProduct(
  product: Omit<Product, 'id' | 'created_at' | 'updated_at'>,
): Promise<Product> {
  const now = new Date().toISOString();
  const slug = product.slug || product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  if (shouldUseMocks()) {
    // Mode mock : IDs strings (compatibilité localDb.ts / products.json).
    const id = `p-${Date.now()}`;
    const newProduct: Product = {
      id,
      created_at: now,
      updated_at: now,
      ...product,
      slug,
    };
    const list = readProducts();
    list.push(newProduct);
    writeProducts(list);
    return newProduct;
  }

  // Mode Supabase : la colonne id a DEFAULT gen_random_uuid() — ne pas envoyer un id invalide.
  const newProduct = {
    created_at: now,
    updated_at: now,
    ...product,
    slug,
  };
  // Les écritures sur `products` passent par le client service role : la RLS exige
  // `is_admin()`, mais le rôle n'est pas toujours reflété immédiatement dans le JWT
  // (cache session / promotion récente). Les Server Actions ont déjà autorisé
  // l'appelant via `ensureAdminOrMock()` avant d'arriver ici.
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase.from('products').insert(newProduct).select().single();
  if (error) throw error;
  return data as Product;
}

export async function updateProduct(
  id: string,
  product: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>,
): Promise<Product> {
  const now = new Date().toISOString();
  if (shouldUseMocks()) {
    const list = readProducts();
    const idx = list.findIndex((p) => p.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...product, updated_at: now };
      writeProducts(list);
      return list[idx];
    }
    throw new Error('Product not found in mocks');
  }

  // Écriture admin → service role (cf. note de createProduct ci-dessus).
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from('products')
    .update({ ...product, updated_at: now })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  if (shouldUseMocks()) {
    const list = readProducts();
    const idx = list.findIndex((p) => p.id === id);
    if (idx !== -1) {
      list.splice(idx, 1);
      writeProducts(list);
      return;
    }
    throw new Error('Product not found in mocks');
  }

  // Suppression admin → service role (cf. note de createProduct).
  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

export async function updateProductStock(productId: string, delta: number): Promise<void> {
  if (shouldUseMocks()) {
    const list = readProducts();
    const p = list.find((x) => x.id === productId);
    if (p) {
      p.stock = Math.max(0, p.stock + delta);
      writeProducts(list);
    }
    return;
  }
  // Décrément/incrément de stock — appelé depuis la création de commande (admin)
  // et depuis la confirmation de paiement (client). Service role évite l'erreur RLS.
  const supabase = await getSupabaseAdmin();
  const { data } = await supabase.from('products').select('stock').eq('id', productId).single();
  if (!data) return;
  await supabase
    .from('products')
    .update({ stock: Math.max(0, data.stock + delta) })
    .eq('id', productId);
}

/**
 * Enregistre un MOUVEMENT de stock pour un produit :
 *  - applique `delta` (signé : +N entrée, -N sortie) au stock existant ;
 *  - journalise l'événement dans `product_restock_history` (delta, date, motif,
 *    auteur, note) ;
 *  - met à jour automatiquement `is_out_of_stock` si le stock tombe à 0.
 *
 * Retourne le produit mis à jour + l'événement créé. Le `restock_date` est la
 * date effective du mouvement saisie par l'admin (YYYY-MM-DD), distincte du
 * `created_at` qui est l'instant serveur de l'enregistrement.
 *
 * Pour un motif `restock`, `return` ou `direct_sale`, la direction est imposée :
 * `restock`/`return` → +N ; `direct_sale`/`loss` → -N. Pour `correction`/`other`,
 * le signe est libre mais `note` est obligatoire (toute correction doit être
 * tracée textuellement).
 */
export async function adjustProductStock(
  productId: string,
  input: {
    delta: number;
    restock_date: string; // YYYY-MM-DD
    reason: StockMovementReason;
    note?: string | null;
    created_by?: string | null;
    /**
     * Si fourni, le mouvement s'applique à une localité spécifique : on maj
     * `product_location_stock` (et le trigger SQL recalcule `products.stock`
     * global en SUM). Si null/absent, comportement legacy : maj directe de
     * `products.stock` sans localité (back-compat avec l'existant).
     */
    locality_id?: string | null;
  },
): Promise<{ product: Product; event: ProductRestock; locality_stock?: number | null }> {
  if (!Number.isFinite(input.delta) || !Number.isInteger(input.delta) || input.delta === 0) {
    throw new Error('Quantité invalide : entier non-zéro attendu.');
  }
  if (Math.abs(input.delta) > 100_000) {
    throw new Error('Quantité trop importante (max ±100 000).');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.restock_date)) {
    throw new Error("Date d'approvisionnement invalide (format YYYY-MM-DD attendu).");
  }

  const note = input.note?.trim() ? input.note.trim().slice(0, 500) : null;

  // Validation par motif : on force la direction pour les motifs contraints et
  // on exige une note pour les motifs ambigus (correction, autre).
  switch (input.reason) {
    case 'restock':
    case 'return':
      if (input.delta <= 0) {
        throw new Error('Une entrée de stock (réassort / retour) doit avoir une quantité > 0.');
      }
      break;
    case 'direct_sale':
    case 'loss':
      if (input.delta >= 0) {
        throw new Error('Une sortie de stock (vente / perte) doit avoir une quantité < 0.');
      }
      break;
    case 'correction':
    case 'other':
      if (!note) {
        throw new Error('Une note est obligatoire pour ce motif (justification requise).');
      }
      break;
    default:
      throw new Error('Motif invalide.');
  }

  const event: ProductRestock = {
    id: `mv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_id: productId,
    quantity: input.delta,
    restock_date: input.restock_date,
    reason: input.reason,
    note,
    created_by: input.created_by ?? null,
    created_at: new Date().toISOString(),
  };

  // ----- MODE MOCK -----
  if (shouldUseMocks()) {
    const list = readProducts();
    const idx = list.findIndex((p) => p.id === productId);
    if (idx === -1) throw new Error('Produit introuvable.');

    // Si localité précisée : on maj product_location_stock et on RECALCULE
    // manuellement le stock global (le trigger SQL n'existe pas en mock).
    if (input.locality_id) {
      const path = require('path');
      const fs = require('fs');
      const plsFile = path.join(process.cwd(), 'data-store', 'product_location_stock.json');
      let arr: Array<{
        product_id: string;
        location_id: string;
        quantity: number;
        updated_at: string;
      }> = [];
      if (fs.existsSync(plsFile)) arr = JSON.parse(fs.readFileSync(plsFile, 'utf-8'));
      const existing = arr.find(
        (r) => r.product_id === productId && r.location_id === input.locality_id,
      );
      const previousQty = existing?.quantity ?? 0;
      const newQty = Math.max(0, previousQty + event.quantity);
      if (existing) {
        existing.quantity = newQty;
        existing.updated_at = event.created_at;
      } else {
        arr.push({
          product_id: productId,
          location_id: input.locality_id,
          quantity: newQty,
          updated_at: event.created_at,
        });
      }
      fs.writeFileSync(plsFile, JSON.stringify(arr, null, 2));

      // Recalcule products.stock = SUM(qty) pour ce produit (mock : pas de trigger).
      const newGlobal = arr
        .filter((r) => r.product_id === productId)
        .reduce((acc, r) => acc + r.quantity, 0);
      list[idx] = {
        ...list[idx],
        stock: newGlobal,
        is_out_of_stock: newGlobal === 0 ? true : newGlobal > 0 ? false : list[idx].is_out_of_stock,
        updated_at: event.created_at,
      };
      writeProducts(list);

      const history = readRestockHistory();
      // Marque la localité source (pour les entrées : c'est aussi la destination).
      history.push({ ...event, source_location_id: input.locality_id } as any);
      writeRestockHistory(history);
      return { product: list[idx], event, locality_stock: newQty };
    }

    // Pas de localité : comportement legacy inchangé.
    const previousStock = list[idx].stock ?? 0;
    const newStock = Math.max(0, previousStock + event.quantity);
    list[idx] = {
      ...list[idx],
      stock: newStock,
      is_out_of_stock: newStock === 0 ? true : newStock > 0 ? false : list[idx].is_out_of_stock,
      updated_at: event.created_at,
    };
    writeProducts(list);

    const history = readRestockHistory();
    history.push(event);
    writeRestockHistory(history);
    return { product: list[idx], event };
  }

  // Mode Supabase : on lit le stock, on calcule la nouvelle valeur, on UPDATE,
  // puis on INSERT l'événement. Service role pour contourner la RLS.
  const supabase = await getSupabaseAdmin();

  // ----- CAS AVEC LOCALITÉ -----
  if (input.locality_id) {
    // Upsert dans product_location_stock. Le trigger SQL recalcule products.stock.
    const { data: upserted, error: upErr } = await supabase
      .from('product_location_stock')
      .upsert(
        {
          product_id: productId,
          location_id: input.locality_id,
          updated_at: event.created_at,
        },
        { onConflict: 'product_id,location_id' },
      )
      .select('quantity')
      .single();
    // upErr possible si ligne absente (premier mouvement sur cette localité).
    // On lit alors la ligne ou on l'insère directement.
    let currentQty = (upserted as any)?.quantity ?? null;
    if (currentQty === null) {
      const { data: existing } = await supabase
        .from('product_location_stock')
        .select('quantity')
        .eq('product_id', productId)
        .eq('location_id', input.locality_id)
        .maybeSingle();
      currentQty = existing?.quantity ?? 0;
    }
    const newQty = Math.max(0, currentQty + event.quantity);
    const { error: writeErr } = await supabase.from('product_location_stock').upsert(
      {
        product_id: productId,
        location_id: input.locality_id,
        quantity: newQty,
        updated_at: event.created_at,
      },
      { onConflict: 'product_id,location_id' },
    );
    if (writeErr) throw writeErr;

    // Lecture du stock global recalculé par le trigger SQL.
    const { data: prodRow, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();
    if (prodErr || !prodRow) throw prodErr ?? new Error('Produit introuvable.');

    const { error: histErr } = await supabase.from('product_restock_history').insert({
      id: event.id,
      product_id: event.product_id,
      quantity: event.quantity,
      restock_date: event.restock_date,
      reason: event.reason,
      note: event.note,
      created_by: event.created_by,
      created_at: event.created_at,
      source_location_id: input.locality_id,
    });
    if (histErr) {
      // Rollback : on remet la localité à son ancienne quantité.
      await supabase.from('product_location_stock').upsert(
        {
          product_id: productId,
          location_id: input.locality_id,
          quantity: currentQty,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'product_id,location_id' },
      );
      throw histErr;
    }

    return { product: prodRow as Product, event, locality_stock: newQty };
  }

  // ----- CAS SANS LOCALITÉ (legacy, back-compat) -----
  const { data: row, error: readErr } = await supabase
    .from('products')
    .select('id, stock')
    .eq('id', productId)
    .single();
  if (readErr || !row) throw new Error('Produit introuvable.');

  const previousStock = (row.stock ?? 0) as number;
  const newStock = Math.max(0, previousStock + event.quantity);
  const { data: updated, error: updErr } = await supabase
    .from('products')
    .update({
      stock: newStock,
      is_out_of_stock: newStock === 0 ? true : newStock > 0 ? false : undefined,
      updated_at: event.created_at,
    })
    .eq('id', productId)
    .select()
    .single();
  if (updErr || !updated) throw updErr ?? new Error('Échec de mise à jour du stock.');

  const { error: histErr } = await supabase.from('product_restock_history').insert({
    id: event.id,
    product_id: event.product_id,
    quantity: event.quantity,
    restock_date: event.restock_date,
    reason: event.reason,
    note: event.note,
    created_by: event.created_by,
    created_at: event.created_at,
  });
  if (histErr) {
    // Rollback best-effort : on remet le stock à sa valeur d'origine.
    await supabase.from('products').update({ stock: previousStock }).eq('id', productId);
    throw histErr;
  }

  return { product: updated as Product, event };
}

/**
 * Liste l'historique des mouvements de stock pour un produit donné,
 * du plus récent au plus ancien.
 */
export async function listRestockHistory(productId: string): Promise<ProductRestock[]> {
  if (shouldUseMocks()) {
    const history = readRestockHistory();
    return history
      .filter((r) => r.product_id === productId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from('product_restock_history')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProductRestock[];
}

/**
 * Liste l'historique GLOBAL des mouvements de stock (tous produits),
 * du plus récent au plus ancien. Utilisé par le dashboard
 * `/admin/stocks` pour alimenter les graphes "Entrées / Sorties" et
 * l'indicateur d'activité récente.
 *
 * ⚠️ Volumétrie : peut croître. Le dashboard limite l'usage via
 * `sinceDays` (défaut 90j) pour éviter de charger des années.
 */
export async function listAllRestockHistory(sinceDays = 90): Promise<ProductRestock[]> {
  const sinceIso = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  if (shouldUseMocks()) {
    return readRestockHistory()
      .filter((r) => r.created_at >= sinceIso)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from('product_restock_history')
    .select('*')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProductRestock[];
}

// ============================================================================
// ORDERS
// ============================================================================
export async function listOrders(): Promise<Order[]> {
  if (shouldUseMocks()) return readOrders();
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Order[];
}

/**
 * Liste complète réservée aux écrans staff après contrôle de permission côté
 * serveur. Le client Supabase standard est limité par la RLS aux commandes de
 * l'utilisateur courant ; un commercial/technicien autorisé verrait donc une
 * liste vide. Le service role est utilisé uniquement par ces pages protégées.
 */
export async function listOrdersForStaff(): Promise<Order[]> {
  if (shouldUseMocks()) return readOrders();
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Order[];
}

export async function updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
  if (shouldUseMocks()) {
    const list = readOrders();
    const o = list.find((x) => x.id === orderId);
    if (o) {
      o.status = status;
      const now = new Date().toISOString();
      o.updated_at = now;
      if (status === 'traitee') {
        o.processed_at = now;
        o.tracking_number = o.tracking_number || o.order_number;
      }
      if (status === 'en_livraison') {
        o.shipped_at = now;
        if (!o.estimated_delivery) {
          const eta = new Date();
          eta.setDate(eta.getDate() + 2);
          o.estimated_delivery = eta.toISOString();
        }
      }
      if (status === 'livree') {
        o.delivered_at = now;
      }
      writeOrders(list);
      // Effet de bord : si la commande passe à "livrée", créer les fiches maintenance
      if (status === 'livree') {
        try {
          // import dynamique pour éviter cycle
          const { ensureMaintenanceForOrder } = await import('@/data/repositories');
          await ensureMaintenanceForOrder(o);
        } catch {
          /* no-op */
        }
      }
    }
    return;
  }
  // Update de statut commande par admin → service role (politique `Orders admin all`).
  const supabase = await getSupabaseAdmin();
  await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId);
}

export async function createOrder(input: {
  client_name: string;
  client_phone: string;
  client_address: string;
  client_city: string;
  notes?: string;
  items: { product_id: string; product_name: string; unit_price: number; quantity: number }[];
}): Promise<Order> {
  const subtotal = input.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const delivery = subtotal >= 2000 ? 0 : 50;
  const total = subtotal + delivery;
  const order_number = `CMD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

  if (shouldUseMocks()) {
    const id = `o-${Date.now()}`;
    const order: Order = {
      id,
      order_number,
      user_id: null,
      client_name: input.client_name,
      client_phone: input.client_phone,
      client_address: input.client_address,
      client_city: input.client_city,
      status: 'en_attente',
      subtotal,
      delivery_fee: delivery,
      total,
      notes: input.notes ?? null,
      payment_method: 'cash_on_delivery',
      invoice_generated: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: input.items.map((i, idx) => ({
        id: `${id}-item-${idx}`,
        order_id: id,
        product_id: i.product_id,
        product_name: i.product_name,
        unit_price: i.unit_price,
        quantity: i.quantity,
        line_total: i.unit_price * i.quantity,
      })),
    };
    const list = readOrders();
    list.unshift(order);
    writeOrders(list);
    return order;
  }

  // Création de commande (admin via ManualOrderDialog OU checkout client).
  // Policy : `Orders anonymous insert` autorise user_id NULL ou = auth.uid().
  // Si l'appelant est admin (ManualOrderDialog), auth.uid() != user_id → le
  // client anonyme refuse. On force donc le service role pour bypasser la policy.
  const adminSupabase = await getSupabaseAdmin();
  const { data: userData } = await adminSupabase.auth.getUser();
  const { data, error } = await adminSupabase
    .from('orders')
    .insert({
      order_number,
      user_id: userData?.user?.id ?? null,
      client_name: input.client_name,
      client_phone: input.client_phone,
      client_address: input.client_address,
      client_city: input.client_city,
      notes: input.notes ?? null,
      subtotal,
      delivery_fee: delivery,
      total,
      status: 'en_attente',
      payment_method: 'cash_on_delivery',
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Insert order failed');

  await adminSupabase.from('order_items').insert(
    input.items.map((i) => ({
      order_id: data.id,
      product_id: i.product_id,
      product_name: i.product_name,
      unit_price: i.unit_price,
      quantity: i.quantity,
      line_total: i.unit_price * i.quantity,
    })),
  );

  return { ...(data as Order), items: input.items as unknown as OrderItem[] };
}

/**
 * Réclame les commandes orphelines (user_id NULL) qui correspondent au user
 * courant : correspondance par client_phone (clé métier fiable, requise
 * à la fois au signup et au checkout) puis, en fallback, par client_name
 * normalisé. Une fois rattachées, les commandes apparaissent dans
 * l'espace client ET la policy RLS `Orders self-read` les expose.
 *
 * Sans cette étape, les commandes créées en mode invité (avant
 * authentification) restent invisibles côté client.
 */
export async function claimOrphanOrdersForUser(input: {
  userId: string;
  email: string;
  phone?: string | null;
  fullName?: string | null;
}): Promise<number> {
  if (!input.userId) return 0;
  const phone = (input.phone ?? '').trim();
  const name = (input.fullName ?? '').trim().toLowerCase();

  if (shouldUseMocks()) {
    const orders = readOrders();
    let updated = 0;
    const next = orders.map((o: any) => {
      if (o.user_id) return o;
      const matchPhone = phone && o.client_phone && o.client_phone === phone;
      const matchName = name && o.client_name && o.client_name.trim().toLowerCase() === name;
      if (matchPhone || matchName) {
        updated += 1;
        return { ...o, user_id: input.userId, updated_at: new Date().toISOString() };
      }
      return o;
    });
    if (updated > 0) {
      writeOrders(next);
      // Effet de bord : si une commande rattachée est livrée, on s'assure que
      // les fiches maintenance sont créées (parcours déjà couvert par le
      // listener côté admin, mais on rejoue la garantie côté client).
      try {
        const { ensureMaintenanceForOrder } = await import('@/data/repositories');
        for (const o of next) {
          if (o.user_id === input.userId && o.status === 'livree') {
            await ensureMaintenanceForOrder(o as Order);
          }
        }
      } catch {
        /* no-op */
      }
    }
    return updated;
  }

  const supabase = await getSupabaseAdmin();
  // Match par téléphone (prioritaire), puis par nom. On fait deux updates
  // séquentiels pour rester compatible PostgREST (pas de OR multi-colonnes
  // quand l'une attend une égalité stricte et l'autre une comparaison lower).
  let totalUpdated = 0;
  if (phone) {
    const { data, error } = await supabase
      .from('orders')
      .update({ user_id: input.userId, updated_at: new Date().toISOString() })
      .is('user_id', null)
      .eq('client_phone', phone)
      .select('id');
    if (error) throw error;
    totalUpdated += (data ?? []).length;
  }
  if (name) {
    const { data, error } = await supabase
      .from('orders')
      .update({ user_id: input.userId, updated_at: new Date().toISOString() })
      .is('user_id', null)
      .ilike('client_name', name)
      .select('id');
    if (error) throw error;
    totalUpdated += (data ?? []).length;
  }
  return totalUpdated;
}

// ============================================================================
// USERS / CLIENTS
// ============================================================================
export async function listClients(): Promise<User[]> {
  if (shouldUseMocks()) {
    const all = readUsers();
    return all.filter((u) => u.role === 'client') as User[];
  }
  const supabase = await getSupabase();
  // On selectionne explicitement les champs liés au parrainage pour que
  // l'UI CRM puisse distinguer un client direct d'un client filleul
  // (parrainage) et afficher le code/email du parrain.
  const { data, error } = await supabase
    .from('users')
    .select(
      'id, email, full_name, phone, city, address, avatar_url, google_id, role, nps_score, referral_code, referred_by, cashback_balance, created_at, updated_at',
    )
    .eq('role', 'client')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as User[];
}

/** Liste complète des clients pour les écrans staff autorisés. */
export async function listClientsForStaff(): Promise<User[]> {
  if (shouldUseMocks()) {
    return readUsers().filter((u) => u.role === 'client') as User[];
  }
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select(
      'id, email, full_name, phone, city, address, avatar_url, google_id, role, nps_score, referral_code, referred_by, cashback_balance, created_at, updated_at',
    )
    .eq('role', 'client')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as User[];
}

// ============================================================================
// STAFF ARCHIVE (comptes personnel supprimés, restaurables)
// ============================================================================

export interface ArchivedStaff {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  permissions: Record<string, boolean> | null;
  original_created_at: string | null;
  original_updated_at: string | null;
  archived_at: string;
  archived_reason: string | null;
}

/** Liste les comptes personnel archivés (triés par date d'archive desc). */
export async function listArchivedStaff(): Promise<ArchivedStaff[]> {
  if (shouldUseMocks()) {
    return readArchivedUsers()
      .filter((u) => u.role !== 'client')
      .sort((a, b) => (b.archived_at || '').localeCompare(a.archived_at || ''));
  }
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('users_archive')
    .select('*')
    .neq('role', 'client')
    .order('archived_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ArchivedStaff[];
}

/**
 * Archive un compte client :
 *   1) snapshot vers users_archive
 *   2) suppression de users.json (mock) OU laissé au caller (Supabase)
 * Même principe que archiveStaff() mais pour les comptes clients.
 */
export async function archiveClient(
  client: {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    role: string;
    permissions: Record<string, boolean> | null;
    created_at: string | null;
    updated_at: string | null;
  },
  reason: string | null = null,
): Promise<ArchivedStaff> {
  const entry: ArchivedStaff = {
    id: client.id,
    email: client.email,
    full_name: client.full_name,
    phone: client.phone ?? null,
    role: client.role,
    permissions: client.permissions ?? null,
    original_created_at: client.created_at ?? null,
    original_updated_at: client.updated_at ?? null,
    archived_at: new Date().toISOString(),
    archived_reason: reason,
  };

  if (shouldUseMocks()) {
    const list = readArchivedUsers();
    list.push(entry);
    writeArchivedUsers(list);
    // supprime également de users.json (en mock)
    const users = readUsers().filter((u) => u.id !== client.id);
    writeUsers(users);
    return entry;
  }

  // Snapshot archive → service role.
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase.from('users_archive').insert(entry).select().single();
  if (error) throw error;
  return data as ArchivedStaff;
}

/**
 * Archive un compte personnel :
 *   1) snapshot vers users_archive
 *   2) suppression de users + auth.users (effectuée côté server actions)
 * Le snapshot est conservé ici ; le caller (adminActions) appelle
 * ensuite supabase.auth.admin.deleteUser + users.delete.
 */
export async function archiveStaff(
  staff: {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    role: string;
    permissions: Record<string, boolean> | null;
    created_at: string | null;
    updated_at: string | null;
  },
  reason: string | null = null,
): Promise<ArchivedStaff> {
  const entry: ArchivedStaff = {
    id: staff.id,
    email: staff.email,
    full_name: staff.full_name,
    phone: staff.phone ?? null,
    role: staff.role,
    permissions: staff.permissions ?? null,
    original_created_at: staff.created_at ?? null,
    original_updated_at: staff.updated_at ?? null,
    archived_at: new Date().toISOString(),
    archived_reason: reason,
  };

  if (shouldUseMocks()) {
    const list = readArchivedUsers();
    list.push(entry);
    writeArchivedUsers(list);
    // supprime également de users.json (en mock)
    const users = readUsers().filter((u) => u.id !== staff.id);
    writeUsers(users);
    return entry;
  }

  // Snapshot archive staff (admin) → service role.
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase.from('users_archive').insert(entry).select().single();
  if (error) throw error;
  return data as ArchivedStaff;
}

/**
 * Lit un snapshot d'archive par id (utilisé par restoreArchivedStaff).
 */
export async function getArchivedStaff(id: string): Promise<ArchivedStaff | null> {
  if (shouldUseMocks()) {
    return readArchivedUsers().find((u) => u.id === id) ?? null;
  }
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('users_archive')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ArchivedStaff | null;
}

/**
 * Retire le snapshot de l'archive (appelé après restauration réussie
 * OU après suppression définitive).
 */
export async function removeArchivedStaff(id: string): Promise<void> {
  if (shouldUseMocks()) {
    const list = readArchivedUsers().filter((u) => u.id !== id);
    writeArchivedUsers(list);
    return;
  }
  // Suppression snapshot archive (admin) → service role.
  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from('users_archive').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================================
// MAINTENANCE
// ============================================================================
export async function listMaintenance(): Promise<MaintenanceAlert[]> {
  if (shouldUseMocks()) return [...MOCK_MAINTENANCE];
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('maintenance_alerts')
    .select('*')
    .order('next_filter_change', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MaintenanceAlert[];
}

export async function updateMaintenanceStatus(
  id: string,
  status: MaintenanceProgramStatus,
  statusReason?: string | null,
): Promise<void> {
  if (shouldUseMocks()) {
    const bundle = readMaintenance();
    const r = bundle.records.find((x) => x.id === id);
    if (r) {
      r.status = status;
      if (statusReason !== undefined) r.status_reason = statusReason;
      r.updated_at = new Date().toISOString();
      writeMaintenance(bundle);
    }
    return;
  }
  // Update statut fiche maintenance (admin via MaintenanceTable) → service role.
  const supabase = await getSupabaseAdmin();
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (statusReason !== undefined) update.status_reason = statusReason;
  const { error } = await supabase
    .from('maintenance_records')
    .update(update)
    .eq('id', id);
  if (error) throw error;
}

// ============================================================================
// COMPANY
// ============================================================================
export async function getCompanyProfile(): Promise<CompanyProfile> {
  if (shouldUseMocks()) return MOCK_COMPANY;
  const supabase = await getPublicSupabase();
  const { data, error } = await supabase.from('company_profile').select('*').single();
  if (error || !data) return MOCK_COMPANY;
  return data as CompanyProfile;
}

// ============================================================================
// CATALOGUE PDF (flipbook landing page)
//
// En mode mock : `data-store/catalogue.pdf` + `data-store/catalogue_pdf.json`.
// En mode Supabase : table `eaumalik.catalogue_pdf` (id=singleton, payload bytea,
// filename, size, uploaded_at, uploaded_by). On n'utilise PAS Supabase Storage
// car le bucket public n'est pas (encore) provisionné sur le déploiement
// self-hosted.
// ============================================================================

export interface CataloguePdfRecord {
  filename: string;
  mime: string;
  size: number;
  uploadedAt: string;
  uploadedBy?: string | null;
}

/** Lit les métadonnées du PDF catalogue courant (ou null). */
export async function getCataloguePdf(): Promise<CataloguePdfRecord | null> {
  if (shouldUseMocks()) {
    const { readCataloguePdfMeta, readCataloguePdfBuffer } = await import('@/data/cataloguePdf');
    const meta = readCataloguePdfMeta();
    const buf = readCataloguePdfBuffer();
    if (!meta || !buf) return null;
    return meta;
  }
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from('catalogue_pdf')
    .select('*')
    .eq('id', 'singleton')
    .maybeSingle();
  if (error || !data) return null;
  return {
    filename: data.filename,
    mime: data.mime ?? 'application/pdf',
    size: Number(data.size ?? 0),
    uploadedAt: data.uploaded_at,
    uploadedBy: data.uploaded_by ?? null,
  };
}

/** Lit le buffer binaire du PDF catalogue courant (ou null). */
export async function getCataloguePdfBuffer(): Promise<Buffer | null> {
  if (shouldUseMocks()) {
    const { readCataloguePdfBuffer } = await import('@/data/cataloguePdf');
    return readCataloguePdfBuffer();
  }
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from('catalogue_pdf')
    .select('payload')
    .eq('id', 'singleton')
    .maybeSingle();
  if (error || !data || !data.payload) return null;
  // Supabase retourne bytea en base64 (text) ou Buffer selon driver.
  if (Buffer.isBuffer(data.payload)) return data.payload;
  if (typeof data.payload === 'string') return Buffer.from(data.payload, 'base64');
  return null;
}

/**
 * Écrit le PDF catalogue (remplace l'éventuel précédent).
 * Valide la cohérence (header %PDF) avant d'écrire.
 */
export async function saveCataloguePdf(
  buf: Buffer,
  meta: Omit<CataloguePdfRecord, 'uploadedAt'>,
  uploadedBy?: string | null,
): Promise<CataloguePdfRecord> {
  const { isLikelyPdf, writeCataloguePdf } = await import('@/data/cataloguePdf');
  if (!isLikelyPdf(buf)) {
    throw new Error('Le fichier fourni ne semble pas être un PDF valide.');
  }

  const record: CataloguePdfRecord = {
    ...meta,
    uploadedAt: new Date().toISOString(),
    uploadedBy: uploadedBy ?? null,
  };

  if (shouldUseMocks()) {
    writeCataloguePdf(buf, record);
    return record;
  }
  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from('catalogue_pdf').upsert({
    id: 'singleton',
    payload: buf.toString('base64'),
    filename: record.filename,
    mime: record.mime,
    size: record.size,
    uploaded_at: record.uploadedAt,
    uploaded_by: record.uploadedBy,
  });
  if (error) throw error;
  return record;
}

/** Supprime le PDF catalogue (reset au fallback public). */
export async function deleteCataloguePdfRecord(): Promise<void> {
  if (shouldUseMocks()) {
    const { deleteCataloguePdf } = await import('@/data/cataloguePdf');
    deleteCataloguePdf();
    return;
  }
  const supabase = await getSupabaseAdmin();
  await supabase.from('catalogue_pdf').delete().eq('id', 'singleton');
}

// ============================================================================
// NEWS / ACTUALITÉS / PROMOTIONS
// Schema-tolerant : si les nouvelles colonnes (price/product_ids/...) sont
// absentes (ancien set de données), on les remplit avec des défauts neutres.
// ============================================================================
type RawNews = Partial<News> & {
  id: string;
  title: string;
  content: string;
  created_at: string;
};

function normalizeNews(row: RawNews): News {
  const product_ids = Array.isArray(row.product_ids) ? row.product_ids : [];
  const target_user_ids = Array.isArray(row.target_user_ids) ? row.target_user_ids : [];
  const target_all = row.target_all !== false;
  const price =
    typeof row.price === 'number' ? row.price : row.price == null ? null : Number(row.price);
  const original_price =
    typeof row.original_price === 'number'
      ? row.original_price
      : row.original_price == null
        ? null
        : Number(row.original_price);
  const is_promotion =
    row.is_promotion === true || (typeof price === 'number' && price > 0) || product_ids.length > 0;
  const is_archived = row.is_archived === true;
  const archived_at = row.archived_at ?? null;
  const archived_reason = row.archived_reason ?? null;
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    image_url: row.image_url ?? null,
    price: typeof price === 'number' && !Number.isNaN(price) ? price : null,
    original_price:
      typeof original_price === 'number' && !Number.isNaN(original_price) ? original_price : null,
    product_ids,
    target_all,
    target_user_ids,
    is_promotion,
    valid_until: row.valid_until ?? null,
    is_archived,
    archived_at,
    archived_reason,
    created_at: row.created_at,
  };
}

/** Liste toutes les actualités (admin / carrousel). Triées du plus récent au plus ancien. */
export async function listNews(options?: {
  includeArchived?: boolean;
  /** Filtre supplémentaire : ne retourner que les archivées (ou inversement). */
  archivedOnly?: boolean;
  includeExpired?: boolean;
  promotionOnly?: boolean;
  forUserId?: string;
}): Promise<News[]> {
  const nowIso = new Date().toISOString();
  if (shouldUseMocks()) {
    const rows = readNews() as RawNews[];
    let filtered: RawNews[] = rows;
    if (options?.promotionOnly) {
      filtered = filtered.filter(
        (r) =>
          r.is_promotion === true ||
          (typeof r.price === 'number' && r.price > 0) ||
          (Array.isArray(r.product_ids) && r.product_ids.length > 0),
      );
    }
    if (options?.forUserId) {
      const uid = options.forUserId;
      filtered = filtered.filter((r) => {
        const tAll = r.target_all !== false;
        const tIds = Array.isArray(r.target_user_ids) ? r.target_user_ids : [];
        return tAll || tIds.includes(uid);
      });
    }
    if (!options?.includeExpired) {
      filtered = filtered.filter((r) => !r.valid_until || r.valid_until > nowIso);
    }
    // Filtrage archive : par défaut, on cache les archivées (visiteur / client).
    if (options?.archivedOnly) {
      filtered = filtered.filter((r) => r.is_archived === true);
    } else if (!options?.includeArchived) {
      filtered = filtered.filter((r) => r.is_archived !== true);
    }
    const sorted = filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return sorted.map(normalizeNews);
  }

  const supabase = await getPublicSupabase();
  let query = supabase.from('news').select('*').order('created_at', { ascending: false });
  if (options?.promotionOnly) {
    query = query.or('is_promotion.eq.true,price.gt.0,product_ids.neq.{}');
  }
  if (options?.archivedOnly) {
    query = query.eq('is_archived', true);
  } else if (!options?.includeArchived) {
    query = query.or('is_archived.is.null,is_archived.eq.false');
  }
  const { data, error } = await query;
  if (error) throw error;
  const normalized = ((data ?? []) as RawNews[]).map(normalizeNews);
  if (options?.includeExpired) return normalized;
  return normalized.filter((n) => !n.valid_until || n.valid_until > nowIso);
}

/** Promotions actuellement visibles par un visiteur anonyme (carrousel landing). */
export async function listActivePromotions(limit = 12): Promise<News[]> {
  const all = await listNews({ promotionOnly: true });
  return all.filter((item) => item.target_all).slice(0, limit);
}

/**
 * Crée une actualité / promotion. Utilisée en dernier recours côté repository.
 * Les Server Actions appellent en général Supabase directement (RLS bypass via service role).
 */
export async function createNews(input: Omit<News, 'id' | 'created_at'>): Promise<News> {
  const id = `news-${Date.now()}`;
  const now = new Date().toISOString();
  const record: RawNews = {
    ...input,
    id,
    created_at: now,
    is_promotion: input.is_promotion === true,
    product_ids: input.product_ids ?? [],
    target_user_ids: input.target_user_ids ?? [],
    target_all: input.target_all !== false,
    is_archived: false,
    archived_at: null,
    archived_reason: null,
  };
  const normalized = normalizeNews(record);

  if (shouldUseMocks()) {
    const rows = readNews() as RawNews[];
    rows.unshift(record);
    writeNews(rows);
    return normalized;
  }

  // Écriture admin news → service role (voir note sur createProduct).
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase.from('news').insert(record).select().single();
  if (error) throw error;
  return normalizeNews(data as RawNews);
}

/** Met à jour une actualité / promotion existante (patch partiel). */
export async function updateNews(
  id: string,
  patch: Partial<Omit<News, 'id' | 'created_at'>>,
): Promise<News> {
  if (shouldUseMocks()) {
    const rows = readNews() as RawNews[];
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Actualité introuvable.');
    const updated: RawNews = { ...rows[idx], ...patch, id };
    rows[idx] = updated;
    writeNews(rows);
    return normalizeNews(updated);
  }

  // Écriture admin news → service role.
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase.from('news').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return normalizeNews(data as RawNews);
}

/**
 * Archive (soft-delete) une actualité / promotion. La publication disparaît
 * des affichages publics (carrousel landing, boutique, espace client) mais
 * reste présente en BDD pour audit / restauration.
 */
export async function archiveNews(id: string, reason: string | null = null): Promise<News> {
  const archived_at = new Date().toISOString();
  if (shouldUseMocks()) {
    const rows = readNews() as RawNews[];
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Actualité introuvable.');
    const updated: RawNews = {
      ...rows[idx],
      is_archived: true,
      archived_at,
      archived_reason: reason ?? rows[idx].archived_reason ?? null,
    };
    rows[idx] = updated;
    writeNews(rows);
    return normalizeNews(updated);
  }

  // Archivage admin → service role.
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from('news')
    .update({ is_archived: true, archived_at, archived_reason: reason ?? null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return normalizeNews(data as RawNews);
}

/**
 * Restaure (désarchive) une actualité / promotion.
 */
export async function unarchiveNews(id: string): Promise<News> {
  if (shouldUseMocks()) {
    const rows = readNews() as RawNews[];
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Actualité introuvable.');
    const updated: RawNews = {
      ...rows[idx],
      is_archived: false,
      archived_at: null,
      archived_reason: null,
    };
    rows[idx] = updated;
    writeNews(rows);
    return normalizeNews(updated);
  }

  // Désarchivage admin → service role.
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from('news')
    .update({ is_archived: false, archived_at: null, archived_reason: null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return normalizeNews(data as RawNews);
}

/** Supprime définitivement une actualité / promotion. */
export async function deleteNews(id: string): Promise<void> {
  if (shouldUseMocks()) {
    const rows = readNews() as RawNews[];
    writeNews(rows.filter((r) => r.id !== id));
    return;
  }

  // Suppression admin news → service role.
  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from('news').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================================
// MAINTENANCE (records + interventions)
// ============================================================================

/** Convertit une date ISO en "YYYY-MM-DD" sans heure. */
function isoDateOnly(input: string): string {
  const d = new Date(input);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Ajoute N mois à une date, retourne "YYYY-MM-DD". */
function addMonths(input: string, months: number): string {
  const d = new Date(input);
  d.setMonth(d.getMonth() + months);
  return isoDateOnly(d.toISOString());
}

interface MaintenanceRecordFilters {
  status?: MaintenanceProgramStatus;
  search?: string;
  /** Filtrer par date de prochaine intervention <= X. */
  dueBefore?: string;
  /** Si défini, ne retourne que les records de cette commande. */
  orderId?: string;
}

function hydrateRecordInterventions(
  records: MaintenanceRecord[],
  interventions: MaintenanceIntervention[],
) {
  const byRecord = new Map<string, MaintenanceIntervention[]>();
  interventions.forEach((it) => {
    const arr = byRecord.get(it.record_id) ?? [];
    arr.push(it);
    byRecord.set(it.record_id, arr);
  });
  records.forEach((r) => {
    r.interventions = (byRecord.get(r.id) ?? []).sort((a, b) =>
      b.performed_at.localeCompare(a.performed_at),
    );
  });
}

/** Liste les fiches de maintenance avec filtres optionnels. */
export async function listMaintenanceRecords(
  filters: MaintenanceRecordFilters = {},
): Promise<MaintenanceRecord[]> {
  // Élimine les fiches qui pointent vers des pièces de rechange.
  try {
    await pruneMaintenanceRecordsForConsumables();
  } catch {
    /* silencieux */
  }
  if (shouldUseMocks()) {
    const bundle = readMaintenance();
    let records = [...bundle.records];
    const deliveredOrderIds = new Set(
      readOrders()
        .filter((order) => order.status === 'livree')
        .map((order) => order.id),
    );
    records = records.filter(
      (record) => !!record.order_id && deliveredOrderIds.has(record.order_id),
    );
    if (filters.status) records = records.filter((r) => r.status === filters.status);
    if (filters.orderId) records = records.filter((r) => r.order_id === filters.orderId);
    if (filters.dueBefore)
      records = records.filter(
        (r) => r.next_service_date && r.next_service_date <= filters.dueBefore!,
      );
    if (filters.search) {
      const q = filters.search.toLowerCase();
      records = records.filter(
        (r) =>
          r.client_name.toLowerCase().includes(q) ||
          r.product_name.toLowerCase().includes(q) ||
          (r.client_city ?? '').toLowerCase().includes(q),
      );
    }
    records.sort((a, b) => (b.next_service_date || '').localeCompare(a.next_service_date || ''));
    hydrateRecordInterventions(records, bundle.interventions);
    return records;
  }

  // Les écrans de maintenance sont réservés au personnel côté serveur.
  // Le service role évite que la RLS de la vue `orders` ne masque les
  // commandes livrées et ne fasse apparaître 0 fiche à l'admin.
  const supabase = await getSupabaseAdmin();
  const { data: deliveredOrders, error: deliveredOrdersError } = await supabase
    .from('orders')
    .select('id')
    .eq('status', 'livree');
  if (deliveredOrdersError) throw deliveredOrdersError;
  const deliveredOrderIds = (deliveredOrders ?? []).map((order: { id: string }) => order.id);
  if (deliveredOrderIds.length === 0) return [];
  let query = supabase
    .from('maintenance_records')
    .select('*, interventions:maintenance_interventions(*)')
    .order('next_service_date', { ascending: true });
  query = query.in('order_id', deliveredOrderIds);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.orderId) query = query.eq('order_id', filters.orderId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MaintenanceRecord[];
}

/**
 * Liste les fiches de maintenance visibles par un CLIENT authentifié.
 * Filtre strict par user_id OU par appartenance à une de ses commandes.
 * Côté mock : filtre par user_id puis croise avec les commandes livrées du client.
 * Côté Supabase : utilise le user_id de la session (RLS friendly).
 */
export async function listMaintenanceRecordsForUser(
  userId: string,
  filters: MaintenanceRecordFilters = {},
): Promise<MaintenanceRecord[]> {
  if (!userId) return [];
  // Élimine les fiches qui pointent vers des pièces de rechange (règle
  // business : consommables ne génèrent pas de maintenance). Idempotent.
  try {
    await pruneMaintenanceRecordsForConsumables();
  } catch {
    /* silencieux */
  }
  if (shouldUseMocks()) {
    const bundle = readMaintenance();
    const myOrders = readOrders().filter((o) => o.user_id === userId);
    const myDeliveredIds = new Set(myOrders.filter((o) => o.status === 'livree').map((o) => o.id));
    let records = bundle.records.filter(
      (r) => r.user_id === userId || (r.order_id && myDeliveredIds.has(r.order_id)),
    );
    if (filters.status) records = records.filter((r) => r.status === filters.status);
    if (filters.orderId) records = records.filter((r) => r.order_id === filters.orderId);
    if (filters.dueBefore)
      records = records.filter(
        (r) => r.next_service_date && r.next_service_date <= filters.dueBefore!,
      );
    records.sort((a, b) => (b.next_service_date || '').localeCompare(a.next_service_date || ''));
    hydrateRecordInterventions(records, bundle.interventions);
    return records;
  }
  const supabase = await getSupabaseAdmin();
  // Récupère d'abord les commandes du client (livrées ou non) pour récupérer
  // leurs fiches maintenance via order_id, puis on filtre côté mémoire.
  const { data: myOrders, error: ordersErr } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', userId);
  if (ordersErr) throw ordersErr;
  const myOrderIds = (myOrders ?? []).map((o: { id: string }) => o.id);
  // Récupère les fiches : soit par user_id, soit par order_id dans mes commandes.
  // PostgREST ne supporte pas un OR sur deux colonnes différentes proprement
  // quand l'une attend un IN ; on fait donc deux requêtes parallèles.
  const [byUser, byOrder] = await Promise.all([
    supabase
      .from('maintenance_records')
      .select('*, interventions:maintenance_interventions(*)')
      .eq('user_id', userId),
    myOrderIds.length > 0
      ? supabase
          .from('maintenance_records')
          .select('*, interventions:maintenance_interventions(*)')
          .in('order_id', myOrderIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);
  if (byUser.error) throw byUser.error;
  if (byOrder.error) throw byOrder.error;
  const seen = new Set<string>();
  const merged: MaintenanceRecord[] = [];
  for (const r of [...(byUser.data ?? []), ...(byOrder.data ?? [])]) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      merged.push(r as MaintenanceRecord);
    }
  }
  let records = merged;
  if (filters.status) records = records.filter((r) => r.status === filters.status);
  if (filters.orderId) records = records.filter((r) => r.order_id === filters.orderId);
  if (filters.dueBefore)
    records = records.filter(
      (r) => r.next_service_date && r.next_service_date <= filters.dueBefore!,
    );
  records.sort((a, b) => (b.next_service_date || '').localeCompare(a.next_service_date || ''));
  return records;
}

/** Récupère une fiche par ID. */
export async function getMaintenanceRecord(id: string): Promise<MaintenanceRecord | null> {
  if (shouldUseMocks()) {
    const bundle = readMaintenance();
    const found = bundle.records.find((r) => r.id === id) ?? null;
    if (found) hydrateRecordInterventions([found], bundle.interventions);
    return found;
  }
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from('maintenance_records')
    .select('*, interventions:maintenance_interventions(*)')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as MaintenanceRecord;
}

/**
 * Nettoie les fiches de maintenance qui pointent sur une piece de rechange
 * (category = 'consommables'). Idempotent : safe à appeler à chaque lecture.
 * - mock : réécrit data-store/maintenance.json si des fiches sont retirees.
 * - prod : DELETE ... USING sur la table.
 *
 * Cote SQL la migration 0012 fait le ménage initial ; ce helper rattrape
 * les cas où la migration n'a pas encore été appliquée.
 */
export async function pruneMaintenanceRecordsForConsumables(): Promise<number> {
  if (shouldUseMocks()) {
    const products = readProducts();
    const consommableIds = new Set(
      products.filter((p: any) => p.category === 'consommables').map((p: any) => p.id),
    );
    if (consommableIds.size === 0) return 0;
    const bundle = readMaintenance();
    const before = bundle.records.length;
    const kept = bundle.records.filter((r) => !r.product_id || !consommableIds.has(r.product_id));
    const keptIds = new Set(kept.map((r) => r.id));
    if (kept.length === before) return 0;
    bundle.records = kept;
    bundle.interventions = bundle.interventions.filter((i) => keptIds.has(i.record_id));
    writeMaintenance(bundle);
    return before - kept.length;
  }
  const supabase = await getSupabaseAdmin();
  // PostgREST ne supporte pas JOIN dans DELETE, on fait un sous-select.
  const { data, error } = await supabase
    .from('maintenance_records')
    .delete()
    .in(
      'product_id',
      (await supabase.from('products').select('id').eq('category', 'consommables')).data?.map(
        (p: { id: string }) => p.id,
      ) ?? [],
    )
    .select('id');
  if (error) throw error;
  return (data ?? []).length;
}

/**
 * Crée (si manquant) un programme de maintenance par ligne de produit,
 * à partir d'une commande passée à "livrée".
 *
 * NOTE 2026-07-21 : les pièces de rechange (category = 'consommables',
 * ex : filtre seul, charbon actif, membrane vendue à l'unité) ne
 * génèrent AUCUNE fiche maintenance. Un filtre seul ne s'installe pas
 * et ne se maintient pas : il se remplace à l'achat. Cette règle est
 * appliquée ici pour le mode mock ET par le trigger SQL
 * `ensure_maintenance_on_delivery` (migration 0012) pour la production.
 */
export async function ensureMaintenanceForOrder(order: Order): Promise<MaintenanceRecord[]> {
  const createdOrExisting: MaintenanceRecord[] = [];
  if (order.status !== 'livree') return createdOrExisting;
  const items = order.items ?? [];
  if (items.length === 0) return createdOrExisting;

  if (shouldUseMocks()) {
    const bundle = readMaintenance();
    const now = new Date().toISOString();
    const products = readProducts();
    for (const item of items) {
      // Lookup catégorie produit (défaut 'purificateurs' si produit inconnu
      // pour rester permissif en dev mock).
      const product = products.find((p) => p.id === item.product_id);
      const category = (product?.category as string | undefined) ?? 'purificateurs';
      if (category === 'consommables') continue;

      const exists = bundle.records.find(
        (r) => r.order_id === order.id && r.product_id === item.product_id,
      );
      if (exists) {
        createdOrExisting.push(exists);
        continue;
      }
      const lifespan =
        product?.filter_lifespan_months && product.filter_lifespan_months > 0
          ? product.filter_lifespan_months
          : 6;
      const record: MaintenanceRecord = {
        id: `mr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        client_name: order.client_name,
        client_phone: order.client_phone,
        client_city: order.client_city,
        client_address: order.client_address,
        user_id: order.user_id,
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        install_date: isoDateOnly(order.delivered_at || order.updated_at || now),
        next_service_date: addMonths(
          isoDateOnly(order.delivered_at || order.updated_at || now),
          lifespan,
        ),
        service_interval_months: lifespan,
        status: 'actif',
        notes: `Programme de maintenance créé suite à la livraison de la commande ${order.order_number}.`,
        filter_types:
          item.product_name.toLowerCase().includes('ro') ||
          item.product_name.toLowerCase().includes('osmose')
            ? ['Sediment', 'Carbon', 'RO Membrane', 'Post-Carbon']
            : ['Sediment', 'Carbon', 'Mineral'],
        last_service_date: isoDateOnly(order.delivered_at || order.updated_at || now),
        last_reminder_sent: null,
        total_cost: 0,
        intervention_count: 0,
        created_at: now,
        updated_at: now,
      };
      bundle.records.push(record);
      createdOrExisting.push(record);

      // Intervention initiale automatique = installation
      bundle.interventions.push({
        id: `mi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        record_id: record.id,
        intervention_type: 'inspection',
        performed_at: now,
        technician_name: 'Équipe EAUMALIK',
        description: `Installation et mise en service suite à la commande ${order.order_number}.`,
        parts_used: [],
        cost: 0,
        next_service_date: record.next_service_date,
        outcome: 'completed',
        created_at: now,
      });
    }
    writeMaintenance(bundle);
    return createdOrExisting;
  }

  const supabase = await getSupabaseAdmin();
  // Le trigger SQL crée normalement la fiche. La lecture en service role
  // garantit que le fallback applicatif retrouve aussi les fiches existantes.
  const { data } = await supabase
    .from('maintenance_records')
    .select('*, interventions:maintenance_interventions(*)')
    .eq('order_id', order.id);
  return (data ?? []) as MaintenanceRecord[];
}

/** Met à jour le statut d'une fiche de maintenance (programme). */
export async function updateMaintenanceRecordStatus(
  id: string,
  status: MaintenanceProgramStatus,
  statusReason?: string | null,
): Promise<void> {
  await updateMaintenanceStatus(id, status, statusReason);
}

/** Ajoute une intervention à une fiche. Met à jour les compteurs en cascade. */
export async function addMaintenanceIntervention(input: {
  record_id: string;
  intervention_type: InterventionType;
  description: string;
  performed_at?: string;
  technician_name?: string;
  parts_used?: string[];
  cost?: number;
  next_service_date?: string;
  outcome?: 'completed' | 'pending' | 'failed';
}): Promise<MaintenanceIntervention> {
  const now = new Date().toISOString();
  const intervention: MaintenanceIntervention = {
    id: `mi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    record_id: input.record_id,
    intervention_type: input.intervention_type,
    performed_at: input.performed_at || now,
    technician_name: input.technician_name ?? null,
    description: input.description,
    parts_used: input.parts_used ?? [],
    cost: input.cost ?? 0,
    next_service_date: input.next_service_date ?? null,
    outcome: input.outcome ?? 'completed',
    created_at: now,
  };

  if (shouldUseMocks()) {
    const bundle = readMaintenance();
    bundle.interventions.push(intervention);
    const record = bundle.records.find((r) => r.id === input.record_id);
    if (record) {
      record.last_service_date = isoDateOnly(intervention.performed_at);
      if (intervention.next_service_date) record.next_service_date = intervention.next_service_date;
      record.total_cost = (record.total_cost ?? 0) + (intervention.cost ?? 0);
      if (intervention.outcome === 'completed') {
        record.intervention_count = (record.intervention_count ?? 0) + 1;
        record.status =
          record.next_service_date && record.next_service_date < isoDateOnly(now)
            ? 'a_renouveler'
            : 'actif';
      } else if (intervention.outcome === 'failed') {
        record.status = 'a_renouveler';
      }
      record.updated_at = now;
    }
    writeMaintenance(bundle);
    return intervention;
  }

  // Ajout intervention maintenance (admin) → service role (policy admin all).
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from('maintenance_interventions')
    .insert(intervention)
    .select()
    .single();
  if (error) throw error;
  return data as MaintenanceIntervention;
}

/** Met à jour les notes globales d'une fiche. */
export async function updateMaintenanceNotes(id: string, notes: string): Promise<void> {
  if (shouldUseMocks()) {
    const bundle = readMaintenance();
    const r = bundle.records.find((x) => x.id === id);
    if (r) {
      r.notes = notes;
      r.updated_at = new Date().toISOString();
      writeMaintenance(bundle);
    }
    return;
  }
  // Notes maintenance (admin) → service role.
  const supabase = await getSupabaseAdmin();
  await supabase
    .from('maintenance_records')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', id);
}

// ============================================================================
// RAW READ/WRITE — frontière unique (mock JSON ↔ Supabase)
// Remplace les imports directs de '@/data/localDb' dans les Server Actions et
// Route Handlers. Centralise l'accès aux données : en mode mock on lit/écrit le
// JSON FS (data-store/), en prod on interroge Supabase (service role pour les
// lectures admin, client public pour les produits).
// En prod, les ÉCRITURES ne vont JAMAIS dans le JSON FS (elles lèvent) — les
// appelants les gardent déjà sous `isMockMode()` / `shouldUseMocks()`.
// ============================================================================

/** Client admin (service role, bypass RLS) — lazy pour éviter l'instanciation côté client. */
async function getSupabaseAdmin() {
  const { createSupabaseServiceRoleClient } = await import('@/lib/supabase/server');
  return createSupabaseServiceRoleClient();
}

export async function readUsersRaw(): Promise<any[]> {
  if (shouldUseMocks()) return readUsers();
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase.from('users').select('*');
  if (error) throw error;
  return data ?? [];
}

export async function writeUsersRaw(users: any[]): Promise<void> {
  if (shouldUseMocks()) {
    writeUsers(users);
    return;
  }
  throw new Error('writeUsersRaw: écriture JSON FS interdite en prod (utilisez Supabase Auth).');
}

export async function readPasswordResetsRaw(): Promise<any[]> {
  if (shouldUseMocks()) return readPasswordResets();
  // En prod, le reset est géré par Supabase Auth (resetPasswordForEmail) :
  // on ne stocke pas de tokens côté application.
  return [];
}

export async function writePasswordResetsRaw(resets: any[]): Promise<void> {
  if (shouldUseMocks()) {
    writePasswordResets(resets);
    return;
  }
  throw new Error(
    'writePasswordResetsRaw: écriture JSON FS interdite en prod (utilisez Supabase Auth).',
  );
}

export async function readArchivedUsersRaw(): Promise<any[]> {
  if (shouldUseMocks()) return readArchivedUsers();
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase.from('users_archive').select('*');
  if (error) throw error;
  return data ?? [];
}

// ============================================================================
// LOCATIONS (dépôts / magasins / présentoirs) — cf. migration 0014_locations.sql
// Surface minimale suffisante pour servir la StaffManager (sélection des
// localités affectées à un sous-rôle logistique). L'UI admin complète
// (CRUD, inventaire, transferts) viendra avec `/admin/locations`.
// ============================================================================

import type {
  Location,
  LocationType,
  ProductLocationStockEntry,
  TransferRequestRow,
} from '@/types';
import {
  readLocationsRaw as _readLocationsMock,
  writeLocationsRaw as _writeLocationsMock,
} from './localDb';

/** Liste les localités. Filtre optionnel par type + statut actif/archivé. */
export async function listLocations(filters?: {
  type?: LocationType;
  includeArchived?: boolean;
  onlyActive?: boolean;
}): Promise<Location[]> {
  const wantsType = filters?.type;
  const includeArchived = filters?.includeArchived ?? false;
  const onlyActive = filters?.onlyActive ?? false;

  if (shouldUseMocks()) {
    const all = _readLocationsMock();
    return all
      .filter((l) => (includeArchived ? true : !l.is_archived))
      .filter((l) => (onlyActive ? l.is_active : true))
      .filter((l) => (wantsType ? l.type === wantsType : true))
      .map(normalizeMockLocation);
  }

  const supabase = await getSupabaseAdmin();
  let query = supabase
    .from('locations')
    .select('*')
    .order('type', { ascending: true })
    .order('name', { ascending: true });
  if (!includeArchived) query = query.eq('is_archived', false);
  if (onlyActive) query = query.eq('is_active', true);
  if (wantsType) query = query.eq('type', wantsType);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => normalizeSupabaseLocation(row));
}

/** Convertit un enregistrement snake_case (mock) vers la forme camelCase consommée par l'UI. */
function normalizeMockLocation(row: any): Location {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    type: row.type as LocationType,
    address: row.address ?? null,
    city: row.city ?? null,
    phone: row.phone ?? null,
    capacity_units: Number(row.capacity_units ?? 0),
    capacity_area_m2: Number(row.capacity_area_m2 ?? 0),
    is_active: Boolean(row.is_active),
    is_archived: Boolean(row.is_archived),
    notes: row.notes ?? null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

/** Le mock stocke déjà en snake_case compatible, mais on s'assure du typage. */
function normalizeSupabaseLocation(row: any): Location {
  return normalizeMockLocation(row);
}

// ============================================================================
// CRUD localités — suit le pattern mock (JSON) / Supabase (service_role).
// ============================================================================

export interface LocationInput {
  code: string;
  name: string;
  type: LocationType;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  capacity_units?: number;
  capacity_area_m2?: number;
  is_active?: boolean;
  notes?: string | null;
}

export async function createLocation(input: LocationInput): Promise<Location> {
  const now = new Date().toISOString();
  if (shouldUseMocks()) {
    const all = _readLocationsMock();
    if (all.some((l) => l.code === input.code)) {
      throw new Error(`Code localité déjà utilisé : ${input.code}`);
    }
    const row = {
      id: `loc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      code: input.code,
      name: input.name,
      type: input.type,
      address: input.address ?? null,
      city: input.city ?? null,
      phone: input.phone ?? null,
      capacity_units: input.capacity_units ?? 0,
      capacity_area_m2: input.capacity_area_m2 ?? 0,
      is_active: input.is_active ?? true,
      is_archived: false,
      notes: input.notes ?? null,
      created_at: now,
      updated_at: now,
    };
    all.push(row);
    _writeLocationsMock(all);
    return normalizeMockLocation(row);
  }

  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from('locations')
    .insert({
      code: input.code,
      name: input.name,
      type: input.type,
      address: input.address ?? null,
      city: input.city ?? null,
      phone: input.phone ?? null,
      capacity_units: input.capacity_units ?? 0,
      capacity_area_m2: input.capacity_area_m2 ?? 0,
      is_active: input.is_active ?? true,
      is_archived: false,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return normalizeSupabaseLocation(data);
}

export async function updateLocation(
  id: string,
  partial: Partial<LocationInput>,
): Promise<Location> {
  if (shouldUseMocks()) {
    const all = _readLocationsMock();
    const idx = all.findIndex((l) => l.id === id);
    if (idx < 0) throw new Error('Localité introuvable.');
    if (partial.code && all.some((l) => l.code === partial.code && l.id !== id)) {
      throw new Error(`Code localité déjà utilisé : ${partial.code}`);
    }
    all[idx] = {
      ...all[idx],
      ...partial,
      updated_at: new Date().toISOString(),
    };
    _writeLocationsMock(all);
    return normalizeMockLocation(all[idx]);
  }

  const supabase = await getSupabaseAdmin();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (partial.code !== undefined) patch.code = partial.code;
  if (partial.name !== undefined) patch.name = partial.name;
  if (partial.type !== undefined) patch.type = partial.type;
  if (partial.address !== undefined) patch.address = partial.address;
  if (partial.city !== undefined) patch.city = partial.city;
  if (partial.phone !== undefined) patch.phone = partial.phone;
  if (partial.capacity_units !== undefined) patch.capacity_units = partial.capacity_units;
  if (partial.capacity_area_m2 !== undefined) patch.capacity_area_m2 = partial.capacity_area_m2;
  if (partial.is_active !== undefined) patch.is_active = partial.is_active;
  if (partial.notes !== undefined) patch.notes = partial.notes;
  const { data, error } = await supabase
    .from('locations')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return normalizeSupabaseLocation(data);
}

export async function archiveLocation(id: string): Promise<Location> {
  return updateLocation(id, {/* no field changes, just flip archived */} as any).then(
    async (loc) => {
      if (shouldUseMocks()) {
        const all = _readLocationsMock();
        const idx = all.findIndex((l) => l.id === id);
        all[idx].is_archived = true;
        all[idx].updated_at = new Date().toISOString();
        _writeLocationsMock(all);
        return normalizeMockLocation(all[idx]);
      }
      const supabase = await getSupabaseAdmin();
      const { data, error } = await supabase
        .from('locations')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return normalizeSupabaseLocation(data);
    },
  );
}

export async function restoreLocation(id: string): Promise<Location> {
  if (shouldUseMocks()) {
    const all = _readLocationsMock();
    const idx = all.findIndex((l) => l.id === id);
    if (idx < 0) throw new Error('Localité introuvable.');
    all[idx].is_archived = false;
    all[idx].updated_at = new Date().toISOString();
    _writeLocationsMock(all);
    return normalizeMockLocation(all[idx]);
  }
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from('locations')
    .update({ is_archived: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return normalizeSupabaseLocation(data);
}

export async function purgeLocation(id: string): Promise<void> {
  if (shouldUseMocks()) {
    const all = _readLocationsMock();
    const filtered = all.filter((l) => l.id !== id);
    if (filtered.length === all.length) throw new Error('Localité introuvable.');
    _writeLocationsMock(filtered);
    return;
  }
  const supabase = await getSupabaseAdmin();
  const { error } = await supabase.from('locations').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================================
// product_location_stock — répartition du stock par localité
// ============================================================================

export type { ProductLocationStockEntry } from '@/types';

// (les types canoniques vivent dans @/types — réexport ci-dessus pour rétrocompat.)

/** Lit les répartitions de stock par localité, joint produit + localité. */
export async function listProductLocationStock(filters?: {
  productId?: string;
  locationId?: string;
  onlyPositive?: boolean;
}): Promise<ProductLocationStockEntry[]> {
  if (shouldUseMocks()) {
    return listProductLocationStockMock(filters);
  }
  const supabase = await getSupabaseAdmin();
  let query = supabase.from('product_stock_by_location').select('*');
  if (filters?.productId) query = query.eq('product_id', filters.productId);
  if (filters?.locationId) query = query.eq('location_id', filters.locationId);
  if (filters?.onlyPositive) query = query.gt('quantity', 0);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    product_id: row.product_id,
    location_id: row.location_id,
    quantity: Number(row.quantity),
    updated_at: row.updated_at,
    product: row.product_name
      ? { id: row.product_id, name: row.product_name, category: row.product_category, stock: 0 }
      : undefined,
    location: row.location_code
      ? {
          id: row.location_id,
          code: row.location_code,
          name: row.location_name,
          type: row.location_type,
          address: null,
          city: null,
          phone: null,
          capacity_units: 0,
          capacity_area_m2: 0,
          is_active: true,
          is_archived: false,
          notes: null,
          created_at: '',
          updated_at: '',
        }
      : undefined,
  }));
}

function listProductLocationStockMock(filters?: {
  productId?: string;
  locationId?: string;
  onlyPositive?: boolean;
}): ProductLocationStockEntry[] {
  // Pas de table mock pour product_location_stock : on retourne vide sauf si
  // le fichier existe.
  try {
    const path = require('path');
    const fs = require('fs');
    const file = path.join(process.cwd(), 'data-store', 'product_location_stock.json');
    if (!fs.existsSync(file)) return [];
    const raw: Array<{
      product_id: string;
      location_id: string;
      quantity: number;
      updated_at: string;
    }> = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const locations = _readLocationsMock();
    const products = readProducts();
    return raw
      .filter((r) => (filters?.productId ? r.product_id === filters.productId : true))
      .filter((r) => (filters?.locationId ? r.location_id === filters.locationId : true))
      .filter((r) => (filters?.onlyPositive ? r.quantity > 0 : true))
      .map((r) => {
        const loc = locations.find((l) => l.id === r.location_id);
        const prod = products.find((p) => p.id === r.product_id);
        return {
          product_id: r.product_id,
          location_id: r.location_id,
          quantity: r.quantity,
          updated_at: r.updated_at,
          product: prod
            ? { id: prod.id, name: prod.name, category: prod.category, stock: prod.stock }
            : undefined,
          location: loc ? normalizeMockLocation(loc) : undefined,
        };
      });
  } catch {
    return [];
  }
}

export async function upsertProductLocationStock(
  productId: string,
  locationId: string,
  quantity: number,
): Promise<void> {
  if (shouldUseMocks()) {
    const path = require('path');
    const fs = require('fs');
    const file = path.join(process.cwd(), 'data-store', 'product_location_stock.json');
    let arr: Array<{
      product_id: string;
      location_id: string;
      quantity: number;
      updated_at: string;
    }> = [];
    if (fs.existsSync(file)) arr = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const idx = arr.findIndex((r) => r.product_id === productId && r.location_id === locationId);
    if (idx >= 0) arr[idx].quantity = quantity;
    else
      arr.push({
        product_id: productId,
        location_id: locationId,
        quantity,
        updated_at: new Date().toISOString(),
      });
    arr[idx >= 0 ? idx : arr.length - 1].updated_at = new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(arr, null, 2));
    return;
  }
  const supabase = await getSupabaseAdmin();
  const { error } = await supabase
    .from('product_location_stock')
    .upsert(
      {
        product_id: productId,
        location_id: locationId,
        quantity,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'product_id,location_id' },
    );
  if (error) throw error;
}

// ============================================================================
// TRANSFERS — exécute un transfert atomique (mock direct, prod via RPC).
// ============================================================================

export type { TransferRequestRow } from '@/types';

export async function listTransferRequests(filters?: {
  status?: TransferRequestRow['status'];
  productId?: string;
  locationId?: string;
  requesterId?: string;
}): Promise<TransferRequestRow[]> {
  if (shouldUseMocks()) {
    return listTransferRequestsMock(filters);
  }
  const supabase = await getSupabaseAdmin();
  let query = supabase
    .from('transfer_request_details')
    .select('*')
    .order('created_at', { ascending: false });
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.productId) query = query.eq('product_id', filters.productId);
  if (filters?.locationId)
    query = query.or(
      `source_location_id.eq.${filters.locationId},destination_location_id.eq.${filters.locationId}`,
    );
  if (filters?.requesterId) query = query.eq('requester_id', filters.requesterId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TransferRequestRow[];
}

function listTransferRequestsMock(filters?: {
  status?: TransferRequestRow['status'];
  productId?: string;
  locationId?: string;
  requesterId?: string;
}): TransferRequestRow[] {
  try {
    const path = require('path');
    const fs = require('fs');
    const file = path.join(process.cwd(), 'data-store', 'transfer_requests.json');
    if (!fs.existsSync(file)) return [];
    const rows: TransferRequestRow[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return rows
      .filter((r) => (filters?.status ? r.status === filters.status : true))
      .filter((r) => (filters?.productId ? r.product_id === filters.productId : true))
      .filter((r) =>
        filters?.locationId
          ? r.source_location_id === filters.locationId ||
            r.destination_location_id === filters.locationId
          : true,
      )
      .filter((r) => (filters?.requesterId ? r.requester_id === filters.requesterId : true));
  } catch {
    return [];
  }
}

export async function createTransferRequest(input: {
  product_id: string;
  source_location_id: string;
  destination_location_id: string;
  quantity: number;
  request_type?: 'outbound' | 'inbound';
  requester_id: string;
  reason?: string;
}): Promise<TransferRequestRow> {
  const now = new Date().toISOString();
  const row: TransferRequestRow = {
    id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_id: input.product_id,
    source_location_id: input.source_location_id,
    destination_location_id: input.destination_location_id,
    quantity: input.quantity,
    request_type: input.request_type ?? 'outbound',
    requester_id: input.requester_id,
    reason: input.reason ?? null,
    status: 'pending',
    validator_id: null,
    validated_at: null,
    validator_comment: null,
    executed_at: null,
    created_at: now,
    updated_at: now,
  };

  if (shouldUseMocks()) {
    const path = require('path');
    const fs = require('fs');
    const file = path.join(process.cwd(), 'data-store', 'transfer_requests.json');
    let arr: TransferRequestRow[] = [];
    if (fs.existsSync(file)) arr = JSON.parse(fs.readFileSync(file, 'utf-8'));
    arr.unshift(row);
    fs.writeFileSync(file, JSON.stringify(arr, null, 2));
    return row;
  }

  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase
    .from('transfer_requests')
    .insert({
      product_id: input.product_id,
      source_location_id: input.source_location_id,
      destination_location_id: input.destination_location_id,
      quantity: input.quantity,
      request_type: input.request_type ?? 'outbound',
      requester_id: input.requester_id,
      reason: input.reason ?? null,
      status: 'pending',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as TransferRequestRow;
}

export async function updateTransferRequestStatus(
  requestId: string,
  patch: {
    status: TransferRequestRow['status'];
    validator_id?: string;
    validator_comment?: string;
  },
): Promise<TransferRequestRow> {
  const now = new Date().toISOString();
  if (shouldUseMocks()) {
    const path = require('path');
    const fs = require('fs');
    const file = path.join(process.cwd(), 'data-store', 'transfer_requests.json');
    let arr: TransferRequestRow[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const idx = arr.findIndex((r) => r.id === requestId);
    if (idx < 0) throw new Error('Demande introuvable.');
    arr[idx] = {
      ...arr[idx],
      ...patch,
      validated_at:
        patch.status === 'approved' || patch.status === 'rejected' ? now : arr[idx].validated_at,
      updated_at: now,
    };
    fs.writeFileSync(file, JSON.stringify(arr, null, 2));
    return arr[idx];
  }

  const supabase = await getSupabaseAdmin();
  const update: Record<string, unknown> = { status: patch.status, updated_at: now };
  if (patch.validator_id) update.validator_id = patch.validator_id;
  if (patch.validator_comment !== undefined) update.validator_comment = patch.validator_comment;
  if (patch.status === 'approved' || patch.status === 'rejected') update.validated_at = now;
  const { data, error } = await supabase
    .from('transfer_requests')
    .update(update)
    .eq('id', requestId)
    .select('*')
    .single();
  if (error) throw error;
  return data as TransferRequestRow;
}

/**
 * Exécute un transfert atomique :
 *  - Mock : vérifie le stock source, décrémente, incrémente la dest, écrit 2
 *    lignes dans restock_history, recalcule products.stock.
 *  - Supabase : appelle la RPC `eaumalik.execute_transfer_request(p_request_id)`.
 */
export async function executeTransferRequest(requestId: string): Promise<{
  ok: boolean;
  error?: string;
  new_source_qty?: number;
  new_dest_qty?: number;
  new_global_stock?: number;
}> {
  const tr = await listTransferRequests({}).then((rows) => rows.find((r) => r.id === requestId));
  if (!tr) return { ok: false, error: 'Demande introuvable.' };
  if (tr.status !== 'approved')
    return { ok: false, error: `Demande non approuvée (status=${tr.status}).` };

  if (shouldUseMocks()) {
    const entries = await listProductLocationStock({ productId: tr.product_id });
    const source = entries.find((e) => e.location_id === tr.source_location_id);
    if (!source || source.quantity < tr.quantity) {
      return { ok: false, error: 'Stock insuffisant en source.' };
    }
    const newSourceQty = source.quantity - tr.quantity;
    const dest = entries.find((e) => e.location_id === tr.destination_location_id);
    const newDestQty = (dest?.quantity ?? 0) + tr.quantity;
    await upsertProductLocationStock(tr.product_id, tr.source_location_id, newSourceQty);
    await upsertProductLocationStock(tr.product_id, tr.destination_location_id, newDestQty);

    // Audit restock_history (mock)
    const restock = readRestockHistory();
    const transferGroupId = `tr-${requestId}`;
    const srcCode = tr.source_code ?? source.location?.code ?? tr.source_location_id;
    const dstCode = tr.destination_code ?? dest?.location?.code ?? tr.destination_location_id;
    restock.unshift(
      {
        id: `${transferGroupId}-out`,
        product_id: tr.product_id,
        quantity: -tr.quantity,
        restock_date: new Date().toISOString().slice(0, 10),
        reason: 'transfer',
        note: `Transfert sortant vers ${dstCode}`,
        created_by: `transfer-request:${requestId}`,
        created_at: new Date().toISOString(),
      },
      {
        id: `${transferGroupId}-in`,
        product_id: tr.product_id,
        quantity: tr.quantity,
        restock_date: new Date().toISOString().slice(0, 10),
        reason: 'transfer',
        note: `Transfert entrant depuis ${srcCode}`,
        created_by: `transfer-request:${requestId}`,
        created_at: new Date().toISOString(),
      },
    );
    writeRestockHistory(restock);

    // Recalcul products.stock global (mock : SUM sur le tableau mock).
    const all = await listProductLocationStock({ productId: tr.product_id });
    const newGlobal = all.reduce((acc, e) => acc + e.quantity, 0);
    const products = readProducts();
    const idx = products.findIndex((p) => p.id === tr.product_id);
    if (idx >= 0) {
      products[idx].stock = newGlobal;
      writeProducts(products);
    }

    await updateTransferRequestStatus(requestId, { status: 'executed' });
    return {
      ok: true,
      new_source_qty: newSourceQty,
      new_dest_qty: newDestQty,
      new_global_stock: newGlobal,
    };
  }

  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase.rpc('execute_transfer_request', {
    p_request_id: requestId,
  });
  if (error) return { ok: false, error: error.message };
  // La RPC retourne un SETOF (ok, error, new_source_qty, new_dest_qty, new_global_stock).
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.ok) return { ok: false, error: row?.error ?? "Échec de l'exécution." };
  await updateTransferRequestStatus(requestId, { status: 'executed' });
  return {
    ok: true,
    new_source_qty: row.new_source_qty,
    new_dest_qty: row.new_dest_qty,
    new_global_stock: row.new_global_stock,
  };
}

// ============================================================================
// VISIBILITÉ — localités visibles selon le rôle + affectations du user.
// ============================================================================

import { LOGISTICS_ROLE_TO_LOCATION_TYPE, LOGISTICS_ROLES } from '@/lib/supabase/server';

export interface LocationVisibilityUser {
  role: string;
  managed_location_ids?: string[] | null;
}

/**
 * Renvoie la liste des localités que cet utilisateur peut VOIR.
 *  - admin / administrator / sales / stock_manager / admin_assistant : tout
 *  - depot_manager / store_manager / presentoir_manager : intersection
 *    managed_location_ids × localités du type correspondant à leur rôle
 *  - autre (client, etc.) : []
 *
 * IMPORTANT : la fonction est conservative — un store_manager ne peut PAS
 * voir un dépôt même si son UUID est dans managed_location_ids (sécurité).
 */
export function getVisibleLocationsForUser(
  user: LocationVisibilityUser,
  allLocations: Location[],
): Location[] {
  const role = user.role;
  if (['admin', 'administrator', 'sales', 'stock_manager', 'admin_assistant'].includes(role)) {
    return allLocations.filter((l) => !l.is_archived);
  }
  if ((LOGISTICS_ROLES as readonly string[]).includes(role)) {
    const wantedType =
      LOGISTICS_ROLE_TO_LOCATION_TYPE[
        role as 'depot_manager' | 'store_manager' | 'presentoir_manager'
      ];
    const managed = (user.managed_location_ids ?? []).map(String);
    return allLocations.filter(
      (l) => !l.is_archived && l.type === wantedType && managed.includes(l.id),
    );
  }
  return [];
}

/** Détermine si un user peut modifier une localité (créer/supprimer/archiver). */
export function canManageLocation(user: LocationVisibilityUser, location: Location): boolean {
  const role = user.role;
  if (['admin', 'administrator'].includes(role)) return true;
  // Les sous-rôles logistiques peuvent gérer leurs localités affectées (UI future).
  if ((LOGISTICS_ROLES as readonly string[]).includes(role)) {
    const wantedType =
      LOGISTICS_ROLE_TO_LOCATION_TYPE[
        role as 'depot_manager' | 'store_manager' | 'presentoir_manager'
      ];
    const managed = (user.managed_location_ids ?? []).map(String);
    return location.type === wantedType && managed.includes(location.id);
  }
  return false;
}

export async function readOrdersRaw(): Promise<any[]> {
  if (shouldUseMocks()) return readOrders();
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase.from('orders').select('*, items:order_items(*)');
  if (error) throw error;
  return data ?? [];
}

export async function writeOrdersRaw(orders: any[]): Promise<void> {
  if (shouldUseMocks()) {
    writeOrders(orders);
    return;
  }
  throw new Error('writeOrdersRaw: écriture JSON FS interdite en prod.');
}

export async function readMessagesRaw(): Promise<any[]> {
  if (shouldUseMocks()) return readMessages();
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('messages').select('*');
  if (error) throw error;
  return data ?? [];
}

export async function writeMessagesRaw(messages: any[]): Promise<void> {
  if (shouldUseMocks()) {
    writeMessages(messages);
    return;
  }
  throw new Error('writeMessagesRaw: écriture JSON FS interdite en prod.');
}

export async function readNewsRaw(): Promise<any[]> {
  if (shouldUseMocks()) return readNews();
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase.from('news').select('*');
  if (error) throw error;
  return data ?? [];
}

export async function writeNewsRaw(news: any[]): Promise<void> {
  if (shouldUseMocks()) {
    writeNews(news);
    return;
  }
  throw new Error('writeNewsRaw: écriture JSON FS interdite en prod.');
}

export async function readProductsRaw(): Promise<any[]> {
  if (shouldUseMocks()) return readProducts();
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('products').select('*');
  if (error) throw error;
  return data ?? [];
}

export async function readCartsRaw(): Promise<Record<string, any[]>> {
  if (shouldUseMocks()) return readCarts();
  throw new Error('readCartsRaw: lecture JSON FS interdite en prod.');
}

export async function writeCartsRaw(carts: Record<string, any[]>): Promise<void> {
  if (shouldUseMocks()) {
    writeCarts(carts);
    return;
  }
  throw new Error('writeCartsRaw: écriture JSON FS interdite en prod.');
}
