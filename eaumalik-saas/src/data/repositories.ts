// Repository layer — abstraction Supabase ↔ Mocks.
// Bascule automatiquement en fonction de NEXT_PUBLIC_USE_MOCKS et de la présence des credentials.
import 'server-only';
import type {
  Product, Order, OrderItem, User, MaintenanceAlert, CompanyProfile, News,
  MaintenanceRecord, MaintenanceIntervention, InterventionType, MaintenanceProgramStatus,
} from '@/types';
import {
  MOCK_PRODUCTS, MOCK_USERS, MOCK_ORDERS, MOCK_ORDER_ITEMS,
  MOCK_MAINTENANCE, MOCK_COMPANY,
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
  readNews,
  writeNews,
  readMaintenance,
  writeMaintenance,
  readPasswordResets,
  writePasswordResets,
} from '@/data/localDb';
import { sanitizePostgREST } from '@/lib/api-guard';

const shouldUseMocks = (): boolean => {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') return true;
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
};

// Lazy import de @supabase/server pour éviter d'instancier côté client.
async function getSupabase() {
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  return createSupabaseServerClient();
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
      list = list.filter(p => !p.is_archived);
    }
    if (filters?.category && filters.category !== 'all') list = list.filter(p => p.category === filters.category);
    if (filters?.featured) list = list.filter(p => p.is_featured);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)
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

  const supabase = await getSupabase();
  // Tri par ordre manuel (sort_order ASC), puis plus récent en premier.
  let query = supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (!filters?.includeArchived) {
    query = query.or('is_archived.is.null,is_archived.eq.false');
  }
  if (filters?.category && filters.category !== 'all') query = query.eq('category', filters.category);
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

export async function createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
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
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('products').insert(newProduct).select().single();
  if (error) throw error;
  return data as Product;
}

export async function updateProduct(id: string, product: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>): Promise<Product> {
  const now = new Date().toISOString();
  if (shouldUseMocks()) {
    const list = readProducts();
    const idx = list.findIndex(p => p.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...product, updated_at: now };
      writeProducts(list);
      return list[idx];
    }
    throw new Error('Product not found in mocks');
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase.from('products').update({ ...product, updated_at: now }).eq('id', id).select().single();
  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  if (shouldUseMocks()) {
    const list = readProducts();
    const idx = list.findIndex(p => p.id === id);
    if (idx !== -1) {
      list.splice(idx, 1);
      writeProducts(list);
      return;
    }
    throw new Error('Product not found in mocks');
  }

  const supabase = await getSupabase();
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

export async function updateProductStock(productId: string, delta: number): Promise<void> {
  if (shouldUseMocks()) {
    const list = readProducts();
    const p = list.find(x => x.id === productId);
    if (p) {
      p.stock = Math.max(0, p.stock + delta);
      writeProducts(list);
    }
    return;
  }
  const supabase = await getSupabase();
  const { data } = await supabase.from('products').select('stock').eq('id', productId).single();
  if (!data) return;
  await supabase.from('products').update({ stock: Math.max(0, data.stock + delta) }).eq('id', productId);
}

// ============================================================================
// ORDERS
// ============================================================================
export async function listOrders(): Promise<Order[]> {
  if (shouldUseMocks()) return readOrders();
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('orders').select('*, items:order_items(*)').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Order[];
}

export async function updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
  if (shouldUseMocks()) {
    const list = readOrders();
    const o = list.find(x => x.id === orderId);
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
  const supabase = await getSupabase();
  await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId);
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

  const supabase = await getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('orders')
    .insert({
      order_number,
      user_id: userData?.user?.id ?? null,
      client_name: input.client_name,
      client_phone: input.client_phone,
      client_address: input.client_address,
      client_city: input.client_city,
      notes: input.notes ?? null,
      subtotal, delivery_fee: delivery, total,
      status: 'en_attente',
      payment_method: 'cash_on_delivery',
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Insert order failed');

  await supabase.from('order_items').insert(
    input.items.map(i => ({
      order_id: data.id,
      product_id: i.product_id,
      product_name: i.product_name,
      unit_price: i.unit_price,
      quantity: i.quantity,
      line_total: i.unit_price * i.quantity,
    }))
  );

  return { ...(data as Order), items: input.items as unknown as OrderItem[] };
}

// ============================================================================
// USERS / CLIENTS
// ============================================================================
export async function listClients(): Promise<User[]> {
  if (shouldUseMocks()) {
    const all = readUsers();
    return all.filter(u => u.role === 'client') as User[];
  }
  const supabase = await getSupabase();
  // On selectionne explicitement les champs liés au parrainage pour que
  // l'UI CRM puisse distinguer un client direct d'un client filleul
  // (parrainage) et afficher le code/email du parrain.
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, phone, city, address, avatar_url, google_id, role, nps_score, referral_code, referred_by, cashback_balance, created_at, updated_at')
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
      .filter(u => u.role !== 'client')
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
  reason: string | null = null
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
    const users = readUsers().filter(u => u.id !== staff.id);
    writeUsers(users);
    return entry;
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase.from('users_archive').insert(entry).select().single();
  if (error) throw error;
  return data as ArchivedStaff;
}

/**
 * Lit un snapshot d'archive par id (utilisé par restoreArchivedStaff).
 */
export async function getArchivedStaff(id: string): Promise<ArchivedStaff | null> {
  if (shouldUseMocks()) {
    return readArchivedUsers().find(u => u.id === id) ?? null;
  }
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('users_archive').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as ArchivedStaff | null;
}

/**
 * Retire le snapshot de l'archive (appelé après restauration réussie
 * OU après suppression définitive).
 */
export async function removeArchivedStaff(id: string): Promise<void> {
  if (shouldUseMocks()) {
    const list = readArchivedUsers().filter(u => u.id !== id);
    writeArchivedUsers(list);
    return;
  }
  const supabase = await getSupabase();
  const { error } = await supabase.from('users_archive').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================================
// MAINTENANCE
// ============================================================================
export async function listMaintenance(): Promise<MaintenanceAlert[]> {
  if (shouldUseMocks()) return [...MOCK_MAINTENANCE];
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('maintenance_alerts').select('*').order('next_filter_change', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MaintenanceAlert[];
}

export async function updateMaintenanceStatus(id: string, status: MaintenanceProgramStatus): Promise<void> {
  if (shouldUseMocks()) {
    const bundle = readMaintenance();
    const r = bundle.records.find(x => x.id === id);
    if (r) {
      r.status = status;
      r.updated_at = new Date().toISOString();
      writeMaintenance(bundle);
    }
    return;
  }
  const supabase = await getSupabase();
  await supabase
    .from('maintenance_records')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
}

// ============================================================================
// COMPANY
// ============================================================================
export async function getCompanyProfile(): Promise<CompanyProfile> {
  if (shouldUseMocks()) return MOCK_COMPANY;
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('company_profile').select('*').single();
  if (error || !data) return MOCK_COMPANY;
  return data as CompanyProfile;
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
  const price = typeof row.price === 'number' ? row.price : (row.price == null ? null : Number(row.price));
  const original_price = typeof row.original_price === 'number' ? row.original_price : (row.original_price == null ? null : Number(row.original_price));
  const is_promotion =
    row.is_promotion === true ||
    (typeof price === 'number' && price > 0) ||
    product_ids.length > 0;
  const is_archived = row.is_archived === true;
  const archived_at = row.archived_at ?? null;
  const archived_reason = row.archived_reason ?? null;
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    image_url: row.image_url ?? null,
    price: typeof price === 'number' && !Number.isNaN(price) ? price : null,
    original_price: typeof original_price === 'number' && !Number.isNaN(original_price) ? original_price : null,
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
      filtered = filtered.filter(r =>
        r.is_promotion === true ||
        (typeof r.price === 'number' && r.price > 0) ||
        (Array.isArray(r.product_ids) && r.product_ids.length > 0)
      );
    }
    if (options?.forUserId) {
      const uid = options.forUserId;
      filtered = filtered.filter(r => {
        const tAll = r.target_all !== false;
        const tIds = Array.isArray(r.target_user_ids) ? r.target_user_ids : [];
        return tAll || tIds.includes(uid);
      });
    }
    if (!options?.includeExpired) {
      filtered = filtered.filter(r => !r.valid_until || r.valid_until > nowIso);
    }
    // Filtrage archive : par défaut, on cache les archivées (visiteur / client).
    if (options?.archivedOnly) {
      filtered = filtered.filter(r => r.is_archived === true);
    } else if (!options?.includeArchived) {
      filtered = filtered.filter(r => r.is_archived !== true);
    }
    const sorted = filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return sorted.map(normalizeNews);
  }

  const supabase = await getSupabase();
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
  return normalized.filter(n => !n.valid_until || n.valid_until > nowIso);
}

/** Promotions actuellement visibles par un visiteur anonyme (carrousel landing). */
export async function listActivePromotions(limit = 12): Promise<News[]> {
  const all = await listNews({ promotionOnly: true });
  return all.slice(0, limit);
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

  const supabase = await getSupabase();
  const { data, error } = await supabase.from('news').insert(record).select().single();
  if (error) throw error;
  return normalizeNews(data as RawNews);
}

/** Met à jour une actualité / promotion existante (patch partiel). */
export async function updateNews(id: string, patch: Partial<Omit<News, 'id' | 'created_at'>>): Promise<News> {
  if (shouldUseMocks()) {
    const rows = readNews() as RawNews[];
    const idx = rows.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Actualité introuvable.');
    const updated: RawNews = { ...rows[idx], ...patch, id };
    rows[idx] = updated;
    writeNews(rows);
    return normalizeNews(updated);
  }

  const supabase = await getSupabase();
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
    const idx = rows.findIndex(r => r.id === id);
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

  const supabase = await getSupabase();
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
    const idx = rows.findIndex(r => r.id === id);
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

  const supabase = await getSupabase();
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
    writeNews(rows.filter(r => r.id !== id));
    return;
  }

  const supabase = await getSupabase();
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

function hydrateRecordInterventions(records: MaintenanceRecord[], interventions: MaintenanceIntervention[]) {
  const byRecord = new Map<string, MaintenanceIntervention[]>();
  interventions.forEach(it => {
    const arr = byRecord.get(it.record_id) ?? [];
    arr.push(it);
    byRecord.set(it.record_id, arr);
  });
  records.forEach(r => {
    r.interventions = (byRecord.get(r.id) ?? []).sort((a, b) => b.performed_at.localeCompare(a.performed_at));
  });
}

/** Liste les fiches de maintenance avec filtres optionnels. */
export async function listMaintenanceRecords(filters: MaintenanceRecordFilters = {}): Promise<MaintenanceRecord[]> {
  if (shouldUseMocks()) {
    const bundle = readMaintenance();
    let records = [...bundle.records];
    if (filters.status) records = records.filter(r => r.status === filters.status);
    if (filters.orderId) records = records.filter(r => r.order_id === filters.orderId);
    if (filters.dueBefore) records = records.filter(r => r.next_service_date && r.next_service_date <= filters.dueBefore!);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      records = records.filter(r =>
        r.client_name.toLowerCase().includes(q) ||
        r.product_name.toLowerCase().includes(q) ||
        (r.client_city ?? '').toLowerCase().includes(q)
      );
    }
    records.sort((a, b) => (b.next_service_date || '').localeCompare(a.next_service_date || ''));
    hydrateRecordInterventions(records, bundle.interventions);
    return records;
  }

  const supabase = await getSupabase();
  let query = supabase
    .from('maintenance_records')
    .select('*, interventions:maintenance_interventions(*)')
    .order('next_service_date', { ascending: true });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.orderId) query = query.eq('order_id', filters.orderId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MaintenanceRecord[];
}

/** Récupère une fiche par ID. */
export async function getMaintenanceRecord(id: string): Promise<MaintenanceRecord | null> {
  if (shouldUseMocks()) {
    const bundle = readMaintenance();
    const found = bundle.records.find(r => r.id === id) ?? null;
    if (found) hydrateRecordInterventions([found], bundle.interventions);
    return found;
  }
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('maintenance_records')
    .select('*, interventions:maintenance_interventions(*)')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as MaintenanceRecord;
}

/**
 * Crée (si manquant) un programme de maintenance par ligne de produit,
 * à partir d'une commande passée à "livrée".
 */
export async function ensureMaintenanceForOrder(order: Order): Promise<MaintenanceRecord[]> {
  const createdOrExisting: MaintenanceRecord[] = [];
  const items = order.items ?? [];
  if (items.length === 0) return createdOrExisting;

  if (shouldUseMocks()) {
    const bundle = readMaintenance();
    const now = new Date().toISOString();
    for (const item of items) {
      const exists = bundle.records.find(r => r.order_id === order.id && r.product_id === item.product_id);
      if (exists) {
        createdOrExisting.push(exists);
        continue;
      }
      // Récupérer durée filtre produit si possible
      const products = readProducts();
      const product = products.find(p => p.id === item.product_id);
      const lifespan = product?.filter_lifespan_months && product.filter_lifespan_months > 0
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
          lifespan
        ),
        service_interval_months: lifespan,
        status: 'actif',
        notes: `Programme de maintenance créé suite à la livraison de la commande ${order.order_number}.`,
        filter_types:
          item.product_name.toLowerCase().includes('ro') || item.product_name.toLowerCase().includes('osmose')
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

  const supabase = await getSupabase();
  // En prod, c'est le trigger SQL `ensure_maintenance_on_delivery` qui fait ce travail.
  const { data } = await supabase
    .from('maintenance_records')
    .select('*, interventions:maintenance_interventions(*)')
    .eq('order_id', order.id);
  return (data ?? []) as MaintenanceRecord[];
}

/** Met à jour le statut d'une fiche de maintenance (programme). */
export async function updateMaintenanceRecordStatus(
  id: string,
  status: MaintenanceProgramStatus
): Promise<void> {
  if (shouldUseMocks()) {
    const bundle = readMaintenance();
    const r = bundle.records.find(x => x.id === id);
    if (r) {
      r.status = status;
      r.updated_at = new Date().toISOString();
      writeMaintenance(bundle);
    }
    return;
  }
  const supabase = await getSupabase();
  await supabase
    .from('maintenance_records')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
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
    const record = bundle.records.find(r => r.id === input.record_id);
    if (record) {
      record.last_service_date = isoDateOnly(intervention.performed_at);
      if (intervention.next_service_date) record.next_service_date = intervention.next_service_date;
      record.total_cost = (record.total_cost ?? 0) + (intervention.cost ?? 0);
      if (intervention.outcome === 'completed') {
        record.intervention_count = (record.intervention_count ?? 0) + 1;
        record.status = record.next_service_date && record.next_service_date < isoDateOnly(now)
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

  const supabase = await getSupabase();
  const { data, error } = await supabase.from('maintenance_interventions').insert(intervention).select().single();
  if (error) throw error;
  return data as MaintenanceIntervention;
}

/** Met à jour les notes globales d'une fiche. */
export async function updateMaintenanceNotes(id: string, notes: string): Promise<void> {
  if (shouldUseMocks()) {
    const bundle = readMaintenance();
    const r = bundle.records.find(x => x.id === id);
    if (r) { r.notes = notes; r.updated_at = new Date().toISOString(); writeMaintenance(bundle); }
    return;
  }
  const supabase = await getSupabase();
  await supabase.from('maintenance_records').update({ notes, updated_at: new Date().toISOString() }).eq('id', id);
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
  if (shouldUseMocks()) { writeUsers(users); return; }
  throw new Error('writeUsersRaw: écriture JSON FS interdite en prod (utilisez Supabase Auth).');
}

export async function readPasswordResetsRaw(): Promise<any[]> {
  if (shouldUseMocks()) return readPasswordResets();
  // En prod, le reset est géré par Supabase Auth (resetPasswordForEmail) :
  // on ne stocke pas de tokens côté application.
  return [];
}

export async function writePasswordResetsRaw(resets: any[]): Promise<void> {
  if (shouldUseMocks()) { writePasswordResets(resets); return; }
  throw new Error('writePasswordResetsRaw: écriture JSON FS interdite en prod (utilisez Supabase Auth).');
}

export async function readArchivedUsersRaw(): Promise<any[]> {
  if (shouldUseMocks()) return readArchivedUsers();
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase.from('users_archive').select('*');
  if (error) throw error;
  return data ?? [];
}

export async function readOrdersRaw(): Promise<any[]> {
  if (shouldUseMocks()) return readOrders();
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase.from('orders').select('*, items:order_items(*)');
  if (error) throw error;
  return data ?? [];
}

export async function writeOrdersRaw(orders: any[]): Promise<void> {
  if (shouldUseMocks()) { writeOrders(orders); return; }
  throw new Error('writeOrdersRaw: écriture JSON FS interdite en prod.');
}

export async function readNewsRaw(): Promise<any[]> {
  if (shouldUseMocks()) return readNews();
  const supabase = await getSupabaseAdmin();
  const { data, error } = await supabase.from('news').select('*');
  if (error) throw error;
  return data ?? [];
}

export async function writeNewsRaw(news: any[]): Promise<void> {
  if (shouldUseMocks()) { writeNews(news); return; }
  throw new Error('writeNewsRaw: écriture JSON FS interdite en prod.');
}

export async function readProductsRaw(): Promise<any[]> {
  if (shouldUseMocks()) return readProducts();
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('products').select('*');
  if (error) throw error;
  return data ?? [];
}
