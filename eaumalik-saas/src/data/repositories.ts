// Repository layer — abstraction Supabase ↔ Mocks.
// Bascule automatiquement en fonction de NEXT_PUBLIC_USE_MOCKS et de la présence des credentials.
import 'server-only';
import type {
  Product, Order, OrderItem, User, MaintenanceAlert, CompanyProfile, News,
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
    return list;
  }

  const supabase = await getSupabase();
  let query = supabase.from('products').select('*').order('created_at', { ascending: false });
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
  const id = `p-${Date.now()}`;
  const now = new Date().toISOString();
  const newProduct: Product = {
    id,
    created_at: now,
    updated_at: now,
    ...product,
    slug: product.slug || product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  };

  if (shouldUseMocks()) {
    const list = readProducts();
    list.push(newProduct);
    writeProducts(list);
    return newProduct;
  }

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
      writeOrders(list);
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
    return all.filter(u => u.role === 'client');
  }
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('users').select('*').eq('role', 'client').order('created_at', { ascending: false });
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

export async function updateMaintenanceStatus(id: string, status: MaintenanceAlert['status']): Promise<void> {
  if (shouldUseMocks()) {
    const m = MOCK_MAINTENANCE.find(x => x.id === id);
    if (m) { m.status = status; m.updated_at = new Date().toISOString(); }
    return;
  }
  const supabase = await getSupabase();
  await supabase.from('maintenance_alerts').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
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
    created_at: row.created_at,
  };
}

/** Liste toutes les actualités (admin / carrousel). Triées du plus récent au plus ancien. */
export async function listNews(options?: {
  includeArchived?: boolean;
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
    filtered = filtered.filter(r => !r.valid_until || r.valid_until > nowIso);
    const sorted = filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return sorted.map(normalizeNews);
  }

  const supabase = await getSupabase();
  let query = supabase.from('news').select('*').order('created_at', { ascending: false });
  if (options?.promotionOnly) {
    query = query.or('is_promotion.eq.true,price.gt.0,not.product_ids.eq.{}');
  }
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as RawNews[])
    .map(normalizeNews)
    .filter(n => !n.valid_until || n.valid_until > nowIso);
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
export async function createNews(input: Omit<News, 'id' | 'created_at' | 'is_promotion'>): Promise<News> {
  const id = `news-${Date.now()}`;
  const now = new Date().toISOString();
  const record: RawNews = {
    ...input,
    id,
    created_at: now,
    product_ids: input.product_ids ?? [],
    target_user_ids: input.target_user_ids ?? [],
    target_all: input.target_all !== false,
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
